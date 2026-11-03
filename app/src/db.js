const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'hospital_maintenance.db');

// Ensure data directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log(`Connected to SQLite database at ${DB_PATH}`);
  }
});

// Helper for Promisified queries
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// Initialize schema and sample seed data
async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS maintenance_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number TEXT UNIQUE NOT NULL,
      equipment_name TEXT NOT NULL,
      category TEXT NOT NULL,
      department TEXT NOT NULL,
      room_location TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      assigned_technician TEXT DEFAULT 'Unassigned',
      reported_by TEXT NOT NULL,
      resolution_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    )
  `);

  // Seed sample requests if empty
  const countRow = await get(`SELECT COUNT(*) as count FROM maintenance_requests`);
  if (countRow && countRow.count === 0) {
    console.log('Seeding initial hospital maintenance sample data...');
    const samples = [
      {
        ticket: 'HMR-2026-101',
        equipment: 'ICU Electric Hospital Bed #04',
        category: 'BED',
        dept: 'ICU',
        room: 'ICU Bay 4',
        desc: 'Bed elevation motor unresponsive. Patient cannot be repositioned.',
        priority: 'CRITICAL',
        status: 'IN_PROGRESS',
        tech: 'Marcus Vance (Biomed Tech)',
        reporter: 'Nurse Ratched',
        notes: 'Inspecting control board and hydraulic motor.'
      },
      {
        ticket: 'HMR-2026-102',
        equipment: 'Surgical Suite AC Chiller Unit 2',
        category: 'HVAC',
        dept: 'SURGERY',
        room: 'OR-3 Cleanroom',
        desc: 'Room temperature rising above 24C. Must stay under 20C for sterile operations.',
        priority: 'CRITICAL',
        status: 'ASSIGNED',
        tech: 'David Miller (HVAC Specialist)',
        reporter: 'Dr. Evelyn Chen',
        notes: 'Dispatched to rooftop cooling tower.'
      },
      {
        ticket: 'HMR-2026-103',
        equipment: 'Ceiling Surgical Spotlight Fixture',
        category: 'LIGHTING',
        dept: 'SURGERY',
        room: 'OR-1 Trauma Bay',
        desc: 'Flickering LED lamp array during minor emergency procedure.',
        priority: 'HIGH',
        status: 'OPEN',
        tech: 'Unassigned',
        reporter: 'Nurse Sarah Jenkins',
        notes: null
      },
      {
        ticket: 'HMR-2026-104',
        equipment: 'Emergency Room Defibrillator Cart 3',
        category: 'MEDICAL_DEVICE',
        dept: 'EMERGENCY',
        room: 'ER Triage Zone B',
        desc: 'Auxiliary backup battery indicator showing red failure alert.',
        priority: 'CRITICAL',
        status: 'IN_PROGRESS',
        tech: 'Elena Rostova (Clinical Engineer)',
        reporter: 'Dr. Kevin Zhao',
        notes: 'Replacing Li-ion cell pack with spare.'
      },
      {
        ticket: 'HMR-2026-105',
        equipment: 'Maternity Ward Air Filter & Vent',
        category: 'HVAC',
        dept: 'MATERNITY',
        room: 'Room 208 Post-Partum',
        desc: 'Rattling noise in air diffuser vent disturbing newborn resting.',
        priority: 'MEDIUM',
        status: 'OPEN',
        tech: 'Unassigned',
        reporter: 'Staff Midwife Priya Patel',
        notes: null
      },
      {
        ticket: 'HMR-2026-106',
        equipment: 'Pediatrics Bed Safety Rail Lock',
        category: 'BED',
        dept: 'PEDIATRICS',
        room: 'Pediatrics Room 112',
        desc: 'Right side rail lock latch sticks and does not click securely.',
        priority: 'HIGH',
        status: 'RESOLVED',
        tech: 'Marcus Vance (Biomed Tech)',
        reporter: 'Nurse Chloe Rivera',
        notes: 'Replaced latch spring assembly and tested locking mechanism with 50kg load.'
      },
      {
        ticket: 'HMR-2026-107',
        equipment: 'Radiology Corridor Wall Sconce',
        category: 'LIGHTING',
        dept: 'RADIOLOGY',
        room: 'Corridor 4B near MRI suite',
        desc: 'Main corridor bulb completely out, dim hallway causing trip hazard.',
        priority: 'LOW',
        status: 'CLOSED',
        tech: 'Arthur Pendelton (Facilities)',
        reporter: 'Tech Sam Wilson',
        notes: 'Replaced burned fluorescent ballast with energy-efficient LED tube.'
      }
    ];

    for (const s of samples) {
      await run(`
        INSERT INTO maintenance_requests
        (ticket_number, equipment_name, category, department, room_location, description, priority, status, assigned_technician, reported_by, resolution_notes, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        s.ticket, s.equipment, s.category, s.dept, s.room, s.desc,
        s.priority, s.status, s.tech, s.reporter, s.notes,
        s.status === 'RESOLVED' || s.status === 'CLOSED' ? new Date().toISOString() : null
      ]);
    }
  }
}

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase
};
