const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../src/server');
const { initDatabase } = require('../src/db');

test.before(async () => {
  process.env.DB_PATH = ':memory:';
  await initDatabase();
});

test('GET /health returns 200 and healthy status', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'HEALTHY');
  assert.equal(res.body.database, 'connected');
});

test('GET /metrics returns Prometheus text format', async () => {
  const res = await request(app).get('/metrics');
  assert.equal(res.status, 200);
  assert.match(res.text, /hospital_maintenance_/);
});

test('GET /api/stats returns counts and breakdowns', async () => {
  const res = await request(app).get('/api/stats');
  assert.equal(res.status, 200);
  assert.ok(typeof res.body.total === 'number');
  assert.ok(Array.isArray(res.body.byStatus));
  assert.ok(Array.isArray(res.body.byPriority));
});

test('POST /api/requests creates a new maintenance ticket and validates fields', async () => {
  const newTicket = {
    equipment_name: 'Operating Room 3 Surgical Lamp',
    category: 'LIGHTING',
    department: 'SURGERY',
    room_location: 'OR Suite 3',
    description: 'Lamp arm joint loose, drifting during surgical positioning.',
    priority: 'HIGH',
    reported_by: 'Nurse Head Jenkins'
  };

  const res = await request(app)
    .post('/api/requests')
    .send(newTicket);

  assert.equal(res.status, 201);
  assert.ok(res.body.ticket_number.startsWith('HMR-'));
  assert.equal(res.body.equipment_name, newTicket.equipment_name);
  assert.equal(res.body.status, 'OPEN');
  assert.equal(res.body.assigned_technician, 'Unassigned');

  // Verify PATCH updating technician and status
  const ticketId = res.body.id;
  const patchRes = await request(app)
    .patch(`/api/requests/${ticketId}`)
    .send({
      status: 'IN_PROGRESS',
      assigned_technician: 'Marcus Vance (Biomed Tech)',
      resolution_notes: 'Tightening friction clutches and calibrating counterweight.'
    });

  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.status, 'IN_PROGRESS');
  assert.equal(patchRes.body.assigned_technician, 'Marcus Vance (Biomed Tech)');
});
