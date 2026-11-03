require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { run, get, all, initDatabase } = require('./db');
const {
  register,
  metricsMiddleware,
  maintenanceRequestsTotal,
  activeRequestsGauge,
  statusTransitionsTotal,
  technicianAssignmentsTotal,
  updateGaugesFromDb
} = require('./metrics');
const { loadSsmParameters, getConfig } = require('./ssm');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(metricsMiddleware);

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    await updateGaugesFromDb(all);
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// Health check endpoint (for ALB / AWS Route 53 / Monitoring)
app.get('/health', async (req, res) => {
  try {
    const dbCheck = await get(`SELECT 1 as healthy`);
    const isDbHealthy = dbCheck && dbCheck.healthy === 1;
    res.status(isDbHealthy ? 200 : 503).json({
      status: isDbHealthy ? 'HEALTHY' : 'UNHEALTHY',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: isDbHealthy ? 'connected' : 'disconnected',
      configSource: getConfig().source
    });
  } catch (err) {
    res.status(503).json({ status: 'ERROR', error: err.message });
  }
});

// System & SSM Config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    config: getConfig(),
    nodeVersion: process.version,
    platform: process.platform
  });
});

// Summary KPI Statistics
app.get('/api/stats', async (req, res) => {
  try {
    const totalRow = await get(`SELECT COUNT(*) as count FROM maintenance_requests`);
    const openRow = await get(`SELECT COUNT(*) as count FROM maintenance_requests WHERE status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS')`);
    const criticalRow = await get(`SELECT COUNT(*) as count FROM maintenance_requests WHERE priority = 'CRITICAL' AND status != 'CLOSED' AND status != 'RESOLVED'`);
    const resolvedRow = await get(`SELECT COUNT(*) as count FROM maintenance_requests WHERE status IN ('RESOLVED', 'CLOSED')`);

    const byStatus = await all(`SELECT status, COUNT(*) as count FROM maintenance_requests GROUP BY status`);
    const byPriority = await all(`SELECT priority, COUNT(*) as count FROM maintenance_requests GROUP BY priority`);
    const byCategory = await all(`SELECT category, COUNT(*) as count FROM maintenance_requests GROUP BY category`);
    const byDepartment = await all(`SELECT department, COUNT(*) as count FROM maintenance_requests GROUP BY department`);

    res.json({
      total: totalRow.count,
      open: openRow.count,
      critical: criticalRow.count,
      resolved: resolvedRow.count,
      byStatus,
      byPriority,
      byCategory,
      byDepartment
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List Requests with filters
app.get('/api/requests', async (req, res) => {
  try {
    const { status, priority, department, category, search } = req.query;
    let query = `SELECT * FROM maintenance_requests WHERE 1=1`;
    const params = [];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (priority) {
      query += ` AND priority = ?`;
      params.push(priority);
    }
    if (department) {
      query += ` AND department = ?`;
      params.push(department);
    }
    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }
    if (search) {
      query += ` AND (equipment_name LIKE ? OR description LIKE ? OR room_location LIKE ? OR ticket_number LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    query += ` ORDER BY 
      CASE priority
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
      END,
      created_at DESC`;

    const rows = await all(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single request
app.get('/api/requests/:id', async (req, res) => {
  try {
    const row = await get(`SELECT * FROM maintenance_requests WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Request not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Maintenance Request
app.post('/api/requests', async (req, res) => {
  try {
    const {
      equipment_name,
      category,
      department,
      room_location,
      description,
      priority,
      reported_by
    } = req.body;

    if (!equipment_name || !category || !department || !room_location || !description || !priority) {
      return res.status(400).json({
        error: 'Missing required fields: equipment_name, category, department, room_location, description, priority'
      });
    }

    // Generate ticket number
    const countRow = await get(`SELECT COUNT(*) as count FROM maintenance_requests`);
    const nextNum = (countRow ? countRow.count : 0) + 101;
    const ticket_number = `HMR-${new Date().getFullYear()}-${nextNum}`;

    const result = await run(`
      INSERT INTO maintenance_requests
      (ticket_number, equipment_name, category, department, room_location, description, priority, status, assigned_technician, reported_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'OPEN', 'Unassigned', ?)
    `, [
      ticket_number,
      equipment_name.trim(),
      category.toUpperCase(),
      department.toUpperCase(),
      room_location.trim(),
      description.trim(),
      priority.toUpperCase(),
      (reported_by || 'Hospital Staff').trim()
    ]);

    // Prometheus metric increments
    maintenanceRequestsTotal.inc({
      category: category.toUpperCase(),
      department: department.toUpperCase(),
      priority: priority.toUpperCase()
    });

    const newRecord = await get(`SELECT * FROM maintenance_requests WHERE id = ?`, [result.id]);
    await updateGaugesFromDb(all);

    res.status(201).json(newRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Request (Assign Technician, Change Status, Resolution Notes)
app.patch('/api/requests/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await get(`SELECT * FROM maintenance_requests WHERE id = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const { status, assigned_technician, resolution_notes, priority } = req.body;

    const updates = [];
    const params = [];

    if (status && status !== existing.status) {
      updates.push(`status = ?`);
      params.push(status.toUpperCase());
      statusTransitionsTotal.inc({ old_status: existing.status, new_status: status.toUpperCase() });

      if (status.toUpperCase() === 'RESOLVED' || status.toUpperCase() === 'CLOSED') {
        updates.push(`resolved_at = CURRENT_TIMESTAMP`);
      }
    }

    if (assigned_technician !== undefined && assigned_technician !== existing.assigned_technician) {
      updates.push(`assigned_technician = ?`);
      params.push(assigned_technician.trim());
      technicianAssignmentsTotal.inc({ technician: assigned_technician.trim() });
    }

    if (resolution_notes !== undefined) {
      updates.push(`resolution_notes = ?`);
      params.push(resolution_notes.trim());
    }

    if (priority && priority !== existing.priority) {
      updates.push(`priority = ?`);
      params.push(priority.toUpperCase());
    }

    if (updates.length === 0) {
      return res.json(existing);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    await run(`UPDATE maintenance_requests SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await get(`SELECT * FROM maintenance_requests WHERE id = ?`, [id]);
    await updateGaugesFromDb(all);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete request
app.delete('/api/requests/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await run(`DELETE FROM maintenance_requests WHERE id = ?`, [id]);
    await updateGaugesFromDb(all);
    res.json({ message: 'Request deleted successfully', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
async function start() {
  await initDatabase();
  await loadSsmParameters();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🏥 Hospital Maintenance Portal running on port ${PORT}`);
    console.log(`📊 Prometheus Metrics available at http://localhost:${PORT}/metrics`);
    console.log(`🩺 Health check endpoint at http://localhost:${PORT}/health`);
    console.log(`🌐 Web UI available at http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
