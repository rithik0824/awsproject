const client = require('prom-client');

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add default system metrics (CPU, Memory, Event Loop, etc.)
client.collectDefaultMetrics({
  app: 'hospital-maintenance-portal',
  prefix: 'hospital_system_',
  timeout: 10000,
  register
});

// Custom Metric 1: HTTP Request Duration Histogram
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});
register.registerMetric(httpRequestDurationMicroseconds);

// Custom Metric 2: Total Maintenance Requests Logged
const maintenanceRequestsTotal = new client.Counter({
  name: 'hospital_maintenance_requests_created_total',
  help: 'Total number of hospital maintenance requests submitted',
  labelNames: ['category', 'department', 'priority']
});
register.registerMetric(maintenanceRequestsTotal);

// Custom Metric 3: Active Requests by Priority and Status Gauge
const activeRequestsGauge = new client.Gauge({
  name: 'hospital_maintenance_active_requests',
  help: 'Current active maintenance requests in the hospital',
  labelNames: ['priority', 'status', 'department']
});
register.registerMetric(activeRequestsGauge);

// Custom Metric 4: Request Status Transitions Counter
const statusTransitionsTotal = new client.Counter({
  name: 'hospital_maintenance_status_transitions_total',
  help: 'Total status transitions (e.g. OPEN to IN_PROGRESS, IN_PROGRESS to RESOLVED)',
  labelNames: ['old_status', 'new_status']
});
register.registerMetric(statusTransitionsTotal);

// Custom Metric 5: Technician Assignments Counter
const technicianAssignmentsTotal = new client.Counter({
  name: 'hospital_maintenance_technician_assignments_total',
  help: 'Total maintenance assignments to hospital engineers/technicians',
  labelNames: ['technician']
});
register.registerMetric(technicianAssignmentsTotal);

// Middleware to capture request metrics
const metricsMiddleware = (req, res, next) => {
  // Skip metrics path itself to avoid skewed scrape noise
  if (req.path === '/metrics') {
    return next();
  }

  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationInSeconds = diff[0] + diff[1] / 1e9;
    const route = req.route ? req.route.path : req.path;
    httpRequestDurationMicroseconds
      .labels(req.method, route, res.statusCode)
      .observe(durationInSeconds);
  });

  next();
};

// Helper to refresh live gauge from DB
async function updateGaugesFromDb(dbAllFn) {
  try {
    const rows = await dbAllFn(`
      SELECT department, priority, status, COUNT(*) as count 
      FROM maintenance_requests 
      WHERE status NOT IN ('CLOSED') 
      GROUP BY department, priority, status
    `);
    
    activeRequestsGauge.reset();
    rows.forEach(r => {
      activeRequestsGauge.set(
        { department: r.department, priority: r.priority, status: r.status },
        r.count
      );
    });
  } catch (err) {
    console.error('Failed to sync gauge metrics:', err.message);
  }
}

module.exports = {
  register,
  metricsMiddleware,
  maintenanceRequestsTotal,
  activeRequestsGauge,
  statusTransitionsTotal,
  technicianAssignmentsTotal,
  updateGaugesFromDb
};
