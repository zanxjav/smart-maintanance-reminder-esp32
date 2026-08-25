/**
 * VEHICLE MONITOR - APP CONTROLLER
 * 
 * Clean, lightweight orchestrator for the Vehicle Monitor Dashboard.
 */

import { initFirebaseService, subscribeVehicleData, subscribeSpeedLimit, subscribeMaintenanceStatus, subscribeServiceHistory, writeSpeedLimit, isFirebaseActive } from './firebase.js';
import { maintenanceEngine } from './maintenance-engine.js';
import { demoSimulator } from './demo-simulator.js';

let currentSpeed = 42;
let currentSpeedLimit = 60;
let currentOdo = 97128;
let currentTrip = 128.6;
let currentStatus = "Normal";

document.addEventListener('DOMContentLoaded', async () => {
  initClock();
  setupUIEvents();
  setupSpeedLimiterModal();

  // Initialize Firebase or Fallback to Demo Mode
  const initResult = await initFirebaseService();

  // Subscribe to vehicle data
  subscribeVehicleData((data) => {
    handleVehicleDataUpdate(data);
  });

  // Subscribe to speed limit
  subscribeSpeedLimit((limit) => {
    if (limit !== null && limit !== undefined) {
      currentSpeedLimit = Number(limit);
      updateSpeedLimitDisplay(currentSpeedLimit);
    }
  });

  // Subscribe to maintenance updates
  subscribeMaintenanceStatus(() => {
    renderMaintenanceReminders();
  });

  // Subscribe to service history
  subscribeServiceHistory(() => {
    renderMaintenanceReminders();
  });

  // Start simulation if in demo mode
  if (!isFirebaseActive()) {
    demoSimulator.start();
  }

  // Initial renders
  renderMaintenanceReminders();
  populateServiceModalDropdown();
});

/* ==========================================================================
   TOP CLOCK FORMATTING
   ========================================================================== */
function initClock() {
  const clockEl = document.getElementById('liveClockText');
  const update = () => {
    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    if (clockEl) {
      clockEl.textContent = `${day} ${month} ${year}, ${hrs}:${mins}`;
    }
  };
  update();
  setInterval(update, 1000);
}

/* ==========================================================================
   TELEMETRY UPDATES
   ========================================================================== */
function handleVehicleDataUpdate(data) {
  if (!data) return;

  currentSpeed = Number(data.speed) || 0;
  currentOdo = Number(data.odo) || currentOdo;
  currentTrip = Number(data.trip) || currentTrip;
  currentStatus = data.status || currentStatus;

  // DOM elements
  const speedValEl = document.getElementById('valSpeed');
  const speedLargeEl = document.getElementById('valSpeedLarge');
  if (speedValEl) speedValEl.textContent = currentSpeed;
  if (speedLargeEl) speedLargeEl.textContent = currentSpeed;

  const odoEl = document.getElementById('valOdo');
  if (odoEl) odoEl.textContent = maintenanceEngine.formatNumber(currentOdo);

  const tripEl = document.getElementById('valTrip');
  if (tripEl) tripEl.textContent = Number(currentTrip).toFixed(1);

  // Speed Gauge Arc calculation (Scale: 0 to 80 km/h)
  const maxScale = 80;
  const clampedSpeed = Math.min(maxScale, Math.max(0, currentSpeed));
  const arcLength = 236; // Circumference of radius 75 semi-arc
  const offset = arcLength - (clampedSpeed / maxScale) * arcLength;

  const gaugeFill = document.getElementById('speedGaugeFill');
  if (gaugeFill) {
    gaugeFill.style.strokeDashoffset = offset;
    // Over limit styling
    if (currentSpeed > currentSpeedLimit) {
      gaugeFill.style.stroke = '#ef4444';
      if (speedValEl) speedValEl.style.color = '#ef4444';
    } else {
      gaugeFill.style.stroke = '#2563eb';
      if (speedValEl) speedValEl.style.color = '#0f172a';
    }
  }

  // Update Recent Activity if over-speed
  const actDot = document.getElementById('recentActivityDot');
  const actTitle = document.getElementById('recentActivityTitle');
  const actSub = document.getElementById('recentActivitySub');
  const actTime = document.getElementById('recentActivityTime');

  if (currentSpeed > currentSpeedLimit) {
    if (actDot) actDot.className = 'activity-dot red';
    if (actTitle) actTitle.textContent = 'Speed Alert';
    if (actSub) actSub.textContent = `Overspeed: ${currentSpeed} km/h`;
    if (actTime) actTime.textContent = 'Just now';
  }

  maintenanceEngine.setCurrentOdo(currentOdo);
}

function updateSpeedLimitDisplay(limit) {
  const display = document.getElementById('valSpeedLimitDisplay');
  if (display) display.textContent = `${limit} km/h`;
}

/* ==========================================================================
   MAINTENANCE REMINDERS RENDERING
   ========================================================================== */
function renderMaintenanceReminders() {
  const allCards = maintenanceEngine.getAllCardsData();
  const summary = maintenanceEngine.recalculateAllStatuses();

  // Status badge
  const statusBadge = document.getElementById('valVehicleStatus');
  if (statusBadge) {
    if (summary.due > 0) {
      statusBadge.textContent = 'Due Service';
      statusBadge.style.background = '#fef2f2';
      statusBadge.style.color = '#ef4444';
    } else if (summary.warning > 0) {
      statusBadge.textContent = 'Warning';
      statusBadge.style.background = '#fffbeb';
      statusBadge.style.color = '#f59e0b';
    } else {
      statusBadge.textContent = 'Normal';
      statusBadge.style.background = '#ecfdf5';
      statusBadge.style.color = '#10b981';
    }
  }

  // Populate list in Full Maintenance Manager Modal
  const fullContainer = document.getElementById('fullMaintenanceListContainer');
  if (fullContainer) {
    fullContainer.innerHTML = allCards.map(item => `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.85rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a;">${item.name}</div>
          <div style="font-size: 0.75rem; color: #64748b;">Interval: ${maintenanceEngine.formatNumber(item.intervalKm)} KM / ${item.intervalMonths} Bulan</div>
          <div style="font-size: 0.75rem; color: #64748b;">Next: ${maintenanceEngine.formatNumber(item.nextServiceOdo)} KM</div>
        </div>
        <div style="text-align: right;">
          <span style="font-weight: 700; font-size: 0.85rem; color: ${item.status === 'DUE' ? '#ef4444' : (item.status === 'WARNING' ? '#f59e0b' : '#10b981')};">${item.status}</span>
          <div style="font-size: 0.75rem; color: #64748b;">${item.kmLeft > 0 ? `${maintenanceEngine.formatNumber(item.kmLeft)} KM lagi` : 'Jatuh tempo'}</div>
        </div>
      </div>
    `).join('');
  }
}

/* ==========================================================================
   SPEED LIMITER MODAL CONTROLLER
   ========================================================================== */
function setupSpeedLimiterModal() {
  const modal = document.getElementById('modalSpeedLimit');
  const btnOpen = document.getElementById('btnOpenSpeedLimit');
  const slider = document.getElementById('speedLimitRange');
  const sliderVal = document.getElementById('speedLimitSliderVal');
  const form = document.getElementById('formSpeedLimit');
  const presetBtns = document.querySelectorAll('.btn-pre');

  const openModal = () => {
    if (!modal) return;
    if (slider) slider.value = currentSpeedLimit;
    if (sliderVal) sliderVal.textContent = currentSpeedLimit;
    presetBtns.forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.val) === currentSpeedLimit);
    });
    modal.classList.add('open');
  };

  if (btnOpen) btnOpen.addEventListener('click', openModal);

  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      if (sliderVal) sliderVal.textContent = val;
      presetBtns.forEach(btn => {
        btn.classList.toggle('active', Number(btn.dataset.val) === val);
      });
    });
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = Number(btn.dataset.val);
      if (slider) slider.value = val;
      if (sliderVal) sliderVal.textContent = val;
      presetBtns.forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newLimit = Number(slider.value);
      currentSpeedLimit = newLimit;
      demoSimulator.setSpeedLimit(newLimit);
      await writeSpeedLimit(newLimit);
      updateSpeedLimitDisplay(newLimit);
      closeAllModals();
      showToast(`Speed limit diset ke ${newLimit} km/h`, 'success');
      handleVehicleDataUpdate({ speed: currentSpeed, odo: currentOdo, trip: currentTrip });
    });
  }
}

/* ==========================================================================
   UI EVENTS & BOTTOM TAB BAR
   ========================================================================== */
function setupUIEvents() {
  // Bottom Tab Navigation
  const tabs = document.querySelectorAll('.nav-tab-item');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabName = tab.dataset.tab;
      if (tabName === 'trip') {
        demoSimulator.resetTrip();
        showToast('Trip meter direset ke 0.0 km', 'success');
        setTimeout(() => {
          document.getElementById('tabNavDashboard')?.classList.add('active');
          tab.classList.remove('active');
        }, 1000);
      } else if (tabName === 'maintenance') {
        openMaintenanceManager();
      } else if (tabName === 'settings') {
        document.getElementById('modalSpeedLimit')?.classList.add('open');
      }
    });
  });

  // Maintenance click triggers
  document.getElementById('btnViewAllMaintenance')?.addEventListener('click', openMaintenanceManager);
  document.querySelectorAll('.m-row-item').forEach(item => {
    item.addEventListener('click', () => {
      const key = item.dataset.key;
      openServiceModal(key);
    });
  });

  // Add Service Form
  document.getElementById('btnOpenAddServiceForm')?.addEventListener('click', () => {
    closeAllModals();
    openServiceModal();
  });

  const formService = document.getElementById('formAddService');
  if (formService) formService.addEventListener('submit', handleServiceFormSubmit);

  // Modal Closers
  document.querySelectorAll('.modal-close-trigger').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) closeAllModals(); });
  });

  // Notifications button
  document.getElementById('btnNotifications')?.addEventListener('click', () => {
    showToast('Semua sistem kendaraan terpantau normal.', 'success');
  });

  document.getElementById('btnMenu')?.addEventListener('click', () => {
    openMaintenanceManager();
  });
}

function openMaintenanceManager() {
  document.getElementById('modalMaintenanceManager')?.classList.add('open');
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
}

function populateServiceModalDropdown() {
  const select = document.getElementById('serviceTypeSelect');
  if (!select) return;
  const settings = maintenanceEngine.settings;
  select.innerHTML = Object.keys(settings).map(k => `<option value="${k}">${settings[k].name}</option>`).join('');
}

function openServiceModal(preselectKey = null) {
  const modal = document.getElementById('modalAddService');
  if (!modal) return;

  const typeSelect = document.getElementById('serviceTypeSelect');
  const odoInput = document.getElementById('serviceOdoInput');
  const dateInput = document.getElementById('serviceDateInput');

  if (typeSelect && preselectKey) typeSelect.value = preselectKey;
  if (odoInput) odoInput.value = Math.round(currentOdo);
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  modal.classList.add('open');
}

async function handleServiceFormSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('serviceTypeSelect').value;
  const odo = document.getElementById('serviceOdoInput').value;
  const date = document.getElementById('serviceDateInput').value;
  const notes = document.getElementById('serviceNotesInput').value;
  
  const items = [];
  document.querySelectorAll('.part-cb:checked').forEach(cb => items.push(cb.value));

  await maintenanceEngine.logService({ type, odo: Number(odo), date, notes, items });
  closeAllModals();
  renderMaintenanceReminders();
  showToast('Catatan servis berhasil disimpan!', 'success');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
