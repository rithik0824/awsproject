// CareOps - Hospital Maintenance Portal Frontend Logic

let allTickets = [];
let currentConfig = null;

// DOM Elements
const ticketsTbody = document.getElementById('tickets-tbody');
const kpiTotal = document.getElementById('kpi-total');
const kpiCritical = document.getElementById('kpi-critical');
const kpiOpen = document.getElementById('kpi-open');
const kpiResolved = document.getElementById('kpi-resolved');
const recordCount = document.getElementById('record-count');
const hospitalTitle = document.getElementById('hospital-title');
const ssmSourceText = document.getElementById('ssm-source-text');
const ssmEnvTag = document.getElementById('ssm-env-tag');
const liveClock = document.getElementById('live-clock');

// Filter inputs
const filterSearch = document.getElementById('filter-search');
const filterCategory = document.getElementById('filter-category');
const filterPriority = document.getElementById('filter-priority');
const filterStatus = document.getElementById('filter-status');
const filterDept = document.getElementById('filter-dept');
const btnRefresh = document.getElementById('btn-refresh');

// Modals
const modalReport = document.getElementById('modal-report');
const modalManage = document.getElementById('modal-manage');
const modalSsm = document.getElementById('modal-ssm');
const btnOpenReport = document.getElementById('btn-open-report');
const btnShowSsm = document.getElementById('btn-show-ssm');
const formReportFault = document.getElementById('form-report-fault');
const formManageTicket = document.getElementById('form-manage-ticket');

// Live Clock
function updateClock() {
  const now = new Date();
  liveClock.textContent = now.toLocaleTimeString();
}
setInterval(updateClock, 1000);
updateClock();

// Fetch System Configuration & SSM status
async function fetchConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    currentConfig = data.config;

    if (currentConfig.hospitalName) {
      hospitalTitle.textContent = `${currentConfig.hospitalName} - Maintenance Portal`;
    }
    ssmSourceText.textContent = `SSM: ${currentConfig.environment.toUpperCase()}`;
    ssmEnvTag.textContent = `${currentConfig.environment} (${currentConfig.source})`;

    document.getElementById('ssm-json-content').textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    console.error('Failed to load system config:', err);
    ssmSourceText.textContent = 'SSM: Local fallback';
  }
}

// Fetch KPI Stats
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    kpiTotal.textContent = stats.total || 0;
    kpiCritical.textContent = stats.critical || 0;
    kpiOpen.textContent = stats.open || 0;
    kpiResolved.textContent = stats.resolved || 0;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Fetch Tickets with filters
async function fetchTickets() {
  try {
    const params = new URLSearchParams();
    if (filterSearch.value.trim()) params.append('search', filterSearch.value.trim());
    if (filterCategory.value) params.append('category', filterCategory.value);
    if (filterPriority.value) params.append('priority', filterPriority.value);
    if (filterStatus.value) params.append('status', filterStatus.value);
    if (filterDept.value) params.append('department', filterDept.value);

    const res = await fetch(`/api/requests?${params.toString()}`);
    allTickets = await res.json();
    renderTickets(allTickets);
  } catch (err) {
    console.error('Failed to load tickets:', err);
    ticketsTbody.innerHTML = `<tr><td colspan="9" class="loading-cell" style="color: #ef4444;">Failed to load records. Check server connection.</td></tr>`;
  }
}

// Render ticket rows in table
function renderTickets(tickets) {
  recordCount.textContent = `Showing ${tickets.length} tickets`;

  if (tickets.length === 0) {
    ticketsTbody.innerHTML = `<tr><td colspan="9" class="loading-cell">No maintenance tickets matching current filters.</td></tr>`;
    return;
  }

  ticketsTbody.innerHTML = tickets.map(t => {
    const isUnassigned = !t.assigned_technician || t.assigned_technician === 'Unassigned';
    return `
      <tr>
        <td><span class="ticket-tag">${escapeHtml(t.ticket_number)}</span></td>
        <td>
          <div class="equip-cell">
            <span class="equip-name">${escapeHtml(t.equipment_name)}</span>
            <span class="cat-pill">${formatCategory(t.category)}</span>
          </div>
        </td>
        <td>
          <strong>${escapeHtml(t.department)}</strong><br>
          <small class="cat-pill">${escapeHtml(t.room_location)}</small>
        </td>
        <td style="max-width: 280px;">
          <div title="${escapeHtml(t.description)}">${escapeHtml(truncate(t.description, 75))}</div>
          ${t.resolution_notes ? `<small style="color: #059669; display:block; margin-top:4px;">Note: ${escapeHtml(truncate(t.resolution_notes, 50))}</small>` : ''}
        </td>
        <td>
          <span class="badge-priority priority-${t.priority}">${t.priority}</span>
        </td>
        <td>
          <span class="badge-status status-${t.status}">
            <span class="indicator" style="background: currentColor;"></span>
            ${formatStatus(t.status)}
          </span>
        </td>
        <td>
          <span class="tech-info ${isUnassigned ? 'tech-unassigned' : ''}">
            ${escapeHtml(t.assigned_technician || 'Unassigned')}
          </span>
        </td>
        <td>
          <small style="color: var(--text-muted);">${escapeHtml(t.reported_by)}</small>
        </td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="openManageModal(${t.id})">
            Update
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Helper formatting
function formatCategory(cat) {
  const map = {
    BED: '🛏️ Hospital Bed',
    HVAC: '❄️ Air Conditioning / HVAC',
    LIGHTING: '💡 Surgical / Ward Lights',
    MEDICAL_DEVICE: '🩺 Medical Equipment',
    ELECTRICAL: '⚡ Electrical / Power',
    PLUMBING: '🚰 Medical Gas / Plumbing',
    OTHER: '🔧 General Facility'
  };
  return map[cat] || cat;
}

function formatStatus(status) {
  return status.replace('_', ' ');
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Open Manage Ticket Modal
window.openManageModal = function(id) {
  const ticket = allTickets.find(t => t.id === id);
  if (!ticket) return;

  document.getElementById('manage-id').value = ticket.id;
  document.getElementById('manage-ticket-id').textContent = ticket.ticket_number;
  document.getElementById('manage-status').value = ticket.status;
  document.getElementById('manage-tech').value = ticket.assigned_technician || 'Unassigned';
  document.getElementById('manage-priority').value = ticket.priority;
  document.getElementById('manage-notes').value = ticket.resolution_notes || '';

  const summary = `
    <strong>${escapeHtml(ticket.equipment_name)}</strong> (${formatCategory(ticket.category)})<br>
    <strong>Department:</strong> ${escapeHtml(ticket.department)} - ${escapeHtml(ticket.room_location)}<br>
    <strong>Reported Problem:</strong> ${escapeHtml(ticket.description)}<br>
    <strong>Reported by:</strong> ${escapeHtml(ticket.reported_by)} at ${new Date(ticket.created_at).toLocaleString()}
  `;
  document.getElementById('manage-summary-box').innerHTML = summary;

  modalManage.classList.add('active');
};

// Form: Submit New Maintenance Fault
formReportFault.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    equipment_name: document.getElementById('input-equipment').value,
    category: document.getElementById('input-category').value,
    department: document.getElementById('input-dept').value,
    room_location: document.getElementById('input-location').value,
    priority: document.getElementById('input-priority').value,
    reported_by: document.getElementById('input-reporter').value,
    description: document.getElementById('input-desc').value
  };

  try {
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      alert(`Error creating ticket: ${err.error || 'Server error'}`);
      return;
    }

    formReportFault.reset();
    modalReport.classList.remove('active');
    await refreshAll();
  } catch (err) {
    alert(`Failed to submit request: ${err.message}`);
  }
});

// Form: Save Ticket Management Changes
formManageTicket.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('manage-id').value;
  const payload = {
    status: document.getElementById('manage-status').value,
    assigned_technician: document.getElementById('manage-tech').value,
    priority: document.getElementById('manage-priority').value,
    resolution_notes: document.getElementById('manage-notes').value
  };

  try {
    const res = await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      alert(`Error updating ticket: ${err.error || 'Server error'}`);
      return;
    }

    modalManage.classList.remove('active');
    await refreshAll();
  } catch (err) {
    alert(`Failed to update ticket: ${err.message}`);
  }
});

// Modal Event Listeners
btnOpenReport.addEventListener('click', () => modalReport.classList.add('active'));
btnShowSsm.addEventListener('click', () => modalSsm.classList.add('active'));

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetModal = document.getElementById(btn.getAttribute('data-close'));
    if (targetModal) targetModal.classList.remove('active');
  });
});

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('active');
  }
});

// Filter events
[filterSearch, filterCategory, filterPriority, filterStatus, filterDept].forEach(el => {
  el.addEventListener('input', fetchTickets);
  el.addEventListener('change', fetchTickets);
});

btnRefresh.addEventListener('click', refreshAll);

async function refreshAll() {
  await Promise.all([fetchConfig(), fetchStats(), fetchTickets()]);
}

// Initial boot
refreshAll();

