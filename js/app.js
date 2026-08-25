/**
 * VEHICLE MONITORING & MAINTENANCE CONTROLLER
 * 
 * Clean, simple, and functional logic for:
 * - Realtime speed, trip, and odometer telemetry
 * - Dedicated ESP32 speed limiter settings
 * - Automatic maintenance tracking, configurable intervals, and service history
 */

import { initFirebaseService, subscribeVehicleData, subscribeSpeedLimit, subscribeMaintenanceSettings, subscribeMaintenanceStatus, subscribeServiceHistory, writeSpeedLimit, isFirebaseActive } from './firebase.js';
import { maintenanceEngine } from './maintenance-engine.js';
import { demoSimulator } from './demo-simulator.js';

let currentSpeed = 72;
let currentSpeedLimit = 60;
let currentOdo = 97245;
let currentTrip = 124.6;
let currentGps = "Connected";
let currentEsp32 = "Online";
let activeFilter = "ALL";

document.addEventListener('DOMContentLoaded', async () => {
  initClock();
  setupUIEvents();
  setupSpeedLimiterModal();

  // Initialize Firebase or local Demo mode
  const initResult = await initFirebaseService();
  updateConnectionBadge(initResult.status);

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
    renderDashboardHealth();
    renderMaintenanceCards();
  });

  // Subscribe to service history
  subscribeServiceHistory(() => {
    renderServiceHistory();
  });

  // Start simulation if in demo mode
  if (!isFirebaseActive()) {
    demoSimulator.start();
  }

  // Initial renders
  renderDashboardHealth();
  renderMaintenanceCards();
  renderServiceHistory();
  renderSettingsList();
  populateServiceModalDropdown();
});

/* ==========================================================================
   CLOCK & BADGES
   ========================================================================== */
function initClock() {
  const clockEl = document.getElementById('liveClock');
  const update = () => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    if (clockEl) clockEl.textContent = `${hrs}:${mins}:${secs}`;
  };
  update();
  setInterval(update, 1000);
}

function updateConnectionBadge(status) {
  const badge = document.getElementById('firebaseStatusBadge');
  const label = document.getElementById('firebaseStatusText');
  if (!badge || !label) return;

  if (status === 'CONNECTED') {
    badge.className = 'status-badge online';
    label.textContent = 'Firebase Connected';
  } else {
    badge.className = 'status-badge demo';
    label.textContent = 'Demo Mode';
  }
}

/* ==========================================================================
   TELEMETRY UPDATES
   ========================================================================== */
function handleVehicleDataUpdate(data) {
  if (!data) return;

  currentSpeed = Number(data.speed) || 0;
  currentOdo = Number(data.odo) || currentOdo;
  currentTrip = Number(data.trip) || currentTrip;
  currentGps = data.gps || currentGps;
  currentEsp32 = data.esp32 || currentEsp32;

  // Update DOM values
  const speedEl = document.getElementById('valSpeed');
  if (speedEl) speedEl.textContent = currentSpeed;

  const odoEl = document.getElementById('valOdo');
  if (odoEl) odoEl.textContent = maintenanceEngine.formatNumber(currentOdo);

  const tripEl = document.getElementById('valTrip');
  if (tripEl) tripEl.textContent = Number(currentTrip).toFixed(1);

  const lastUpdateEl = document.getElementById('valLastUpdate');
  if (lastUpdateEl) lastUpdateEl.textContent = `Update: ${data.lastUpdate || data.time || "-"}`;

  // Speed Limit Warning Check
  const speedCard = document.getElementById('speedHudCard');
  const warningBanner = document.getElementById('speedWarningBanner');
  const bannerSpeedVal = document.getElementById('bannerCurrentSpeed');
  const bannerLimitVal = document.getElementById('bannerLimitSpeed');

  if (currentSpeed > currentSpeedLimit) {
    if (speedCard) speedCard.classList.add('over-limit');
    if (warningBanner) {
      warningBanner.classList.add('active');
      if (bannerSpeedVal) bannerSpeedVal.textContent = `${currentSpeed} km/h`;
      if (bannerLimitVal) bannerLimitVal.textContent = `${currentSpeedLimit} km/h`;
    }
  } else {
    if (speedCard) speedCard.classList.remove('over-limit');
    if (warningBanner) warningBanner.classList.remove('active');
  }

  maintenanceEngine.setCurrentOdo(currentOdo);
  renderDashboardHealth();
}

function updateSpeedLimitDisplay(limit) {
  document.querySelectorAll('.val-speed-limit').forEach(el => {
    el.textContent = `${limit} km/h`;
  });
}

/* ==========================================================================
   DASHBOARD HEALTH & CAR SENSOR STATUSES
   ========================================================================== */
function renderDashboardHealth() {
  const summary = maintenanceEngine.recalculateAllStatuses();

  const normalCountEl = document.getElementById('summaryCountNormal');
  const warningCountEl = document.getElementById('summaryCountWarning');
  const dueCountEl = document.getElementById('summaryCountDue');

  if (normalCountEl) normalCountEl.textContent = summary.normal;
  if (warningCountEl) warningCountEl.textContent = summary.warning;
  if (dueCountEl) dueCountEl.textContent = summary.due;

  // Update dots on Ayla SVG
  const allCards = maintenanceEngine.getAllCardsData();
  allCards.forEach(item => {
    if (item.sensorNodeId) {
      const nodeEl = document.getElementById(item.sensorNodeId);
      if (nodeEl) {
        nodeEl.className.baseVal = `sensor-pin pin-${item.status.toLowerCase()}`;
        nodeEl.setAttribute('data-key', item.key);
      }
    }
  });
}

/* ==========================================================================
   SPEED LIMITER MODAL CONTROLLER (ESP32)
   ========================================================================== */
function setupSpeedLimiterModal() {
  const modal = document.getElementById('modalSpeedLimit');
  const btnOpen = document.getElementById('btnOpenSpeedLimitModal');
  const btnQuick = document.getElementById('btnQuickAdjustLimit');
  const slider = document.getElementById('speedLimitRange');
  const sliderVal = document.getElementById('speedLimitSliderVal');
  const form = document.getElementById('formSpeedLimit');
  const presetBtns = document.querySelectorAll('.btn-preset');

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
  if (btnQuick) btnQuick.addEventListener('click', openModal);

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
      showToast(`Speed limit diset ke ${newLimit} km/h (Tersimpan ke ESP32)`, 'success');
      handleVehicleDataUpdate({ speed: currentSpeed, odo: currentOdo, trip: currentTrip });
    });
  }
}

/* ==========================================================================
   MAINTENANCE CARDS (DRAWER TAB 1)
   ========================================================================== */
function renderMaintenanceCards() {
  const container = document.getElementById('maintenanceCardsContainer');
  if (!container) return;

  const items = maintenanceEngine.getAllCardsData();
  const filtered = activeFilter === 'ALL' ? items : items.filter(i => i.status === activeFilter);

  if (filtered.length === 0) {
    container.innerHTML = `<p style="color: var(--text-dim); text-align: center; padding: 2rem;">Tidak ada jadwal maintenance dengan status ${activeFilter}</p>`;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="m-card status-${item.status.toLowerCase()}" id="card-${item.key}">
      <div class="m-card-top">
        <span class="m-card-title">${item.name}</span>
        <span class="status-tag">${item.status}</span>
      </div>

      <div class="m-details-grid">
        <div>
          <span class="d-label">Interval</span>
          <div class="d-val">${maintenanceEngine.formatNumber(item.intervalKm)} KM</div>
          <div class="d-sub">${item.intervalMonths} Bulan</div>
        </div>
        <div>
          <span class="d-label">Servis Terakhir</span>
          <div class="d-val">${maintenanceEngine.formatNumber(item.lastServiceOdo)} KM</div>
          <div class="d-sub">${maintenanceEngine.formatDisplayDate(item.lastServiceDate)}</div>
        </div>
        <div>
          <span class="d-label">Servis Berikutnya</span>
          <div class="d-val">${maintenanceEngine.formatNumber(item.nextServiceOdo)} KM</div>
          <div class="d-sub">${maintenanceEngine.formatDisplayDate(item.nextServiceDate)}</div>
        </div>
      </div>

      <div class="progress-wrap">
        <div class="progress-header">
          <span>Pemakaian: <strong>${item.progressPercent}%</strong></span>
          <span>${item.kmLeft > 0 ? `${maintenanceEngine.formatNumber(item.kmLeft)} KM tersisa` : 'Jatuh tempo servis!'}</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${item.progressPercent}%"></div>
        </div>
      </div>

      <div class="m-card-actions">
        <button class="btn-secondary btn-edit-schedule" data-key="${item.key}">
          Ubah Interval
        </button>
        <button class="btn-primary btn-log-single" data-key="${item.key}" data-name="${item.name}">
          Catat Servis
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-log-single').forEach(btn => {
    btn.addEventListener('click', () => openServiceModal(btn.dataset.key, btn.dataset.name));
  });

  container.querySelectorAll('.btn-edit-schedule').forEach(btn => {
    btn.addEventListener('click', () => {
      switchDrawerTab('tab-settings');
      setTimeout(() => {
        const card = document.getElementById(`setting-card-${btn.dataset.key}`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    });
  });
}

/* ==========================================================================
   SETTINGS LIST (DRAWER TAB 2)
   ========================================================================== */
function renderSettingsList() {
  const container = document.getElementById('settingsListContainer');
  if (!container) return;

  const settings = maintenanceEngine.settings;

  container.innerHTML = Object.keys(settings).map(key => {
    const s = settings[key];
    return `
      <div class="setting-row-card" id="setting-card-${key}">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: #fff;">${s.name}</h4>
          <button class="btn-primary btn-save-setting" data-key="${key}">
            Simpan
          </button>
        </div>

        <div class="setting-inputs">
          <div class="field-group">
            <label class="field-label">Interval (KM)</label>
            <input type="number" class="field-input" id="input-km-${key}" value="${s.intervalKm}" step="500">
          </div>
          <div class="field-group">
            <label class="field-label">Interval (Bulan)</label>
            <input type="number" class="field-input" id="input-months-${key}" value="${s.intervalMonths}" min="1">
          </div>
          <div class="field-group">
            <label class="field-label">Reminder (KM)</label>
            <input type="number" class="field-input" id="input-rem-km-${key}" value="${s.reminderKm || 500}">
          </div>
          <div class="field-group">
            <label class="field-label">Reminder (Hari)</label>
            <input type="number" class="field-input" id="input-rem-days-${key}" value="${s.reminderDays || 7}">
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.btn-save-setting').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key;
      const intervalKm = document.getElementById(`input-km-${key}`).value;
      const intervalMonths = document.getElementById(`input-months-${key}`).value;
      const reminderKm = document.getElementById(`input-rem-km-${key}`).value;
      const reminderDays = document.getElementById(`input-rem-days-${key}`).value;

      await maintenanceEngine.updateSetting(key, { intervalKm, intervalMonths, reminderKm, reminderDays });
      showToast(`Interval ${maintenanceEngine.settings[key].name} berhasil disimpan!`, 'success');
      renderMaintenanceCards();
      renderDashboardHealth();
    });
  });
}

/* ==========================================================================
   SERVICE HISTORY TIMELINE (DRAWER TAB 3)
   ========================================================================== */
function renderServiceHistory() {
  const container = document.getElementById('historyTimelineContainer');
  if (!container) return;

  const history = maintenanceEngine.history;
  const historyFilter = document.getElementById('historyFilterSelect')?.value || 'ALL';
  const filtered = historyFilter === 'ALL' ? history : history.filter(h => h.type === historyFilter);

  if (filtered.length === 0) {
    container.innerHTML = `<p style="color: var(--text-dim); text-align: center; padding: 2rem;">Belum ada catatan servis.</p>`;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="history-card">
      <div class="history-top">
        <span class="history-title">${item.typeName || "Servis Mobil"}</span>
        <span class="history-date">${maintenanceEngine.formatDisplayDate(item.date)} • ${maintenanceEngine.formatNumber(item.odo)} KM</span>
      </div>
      <div class="tag-list">
        ${(item.items || []).map(t => `<span class="tag">✓ ${t}</span>`).join('')}
      </div>
      ${item.notes ? `<div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(item.notes)}</div>` : ''}
    </div>
  `).join('');
}

/* ==========================================================================
   UI EVENTS & MODAL CONTROLLERS
   ========================================================================== */
function setupUIEvents() {
  // Check Maintenance CTA button
  const btnCheck = document.getElementById('btnCheckMaintenance');
  if (btnCheck) btnCheck.addEventListener('click', () => openMaintenanceDrawer());

  // Close drawer
  const btnCloseDrawer = document.getElementById('btnCloseDrawer');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeMaintenanceDrawer);
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', (e) => {
      if (e.target === drawerBackdrop) closeMaintenanceDrawer();
    });
  }

  // Drawer tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchDrawerTab(btn.dataset.tab));
  });

  // Filter in drawer
  const filterSelect = document.getElementById('maintenanceStatusFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      activeFilter = e.target.value;
      renderMaintenanceCards();
    });
  }

  // Reset Trip button
  const btnResetTrip = document.getElementById('btnResetTrip');
  if (btnResetTrip) {
    btnResetTrip.addEventListener('click', () => {
      demoSimulator.trip = 0.0;
      demoSimulator.tick();
      showToast('Trip meter direset ke 0.0 km', 'success');
    });
  }

  // Add Service Form submit
  const formService = document.getElementById('formAddService');
  if (formService) formService.addEventListener('submit', handleServiceFormSubmit);

  // Add Custom Setting Form submit
  const formCustom = document.getElementById('formAddCustomSetting');
  if (formCustom) formCustom.addEventListener('submit', handleCustomSettingSubmit);

  const btnOpenAddService = document.getElementById('btnOpenAddServiceModal');
  if (btnOpenAddService) btnOpenAddService.addEventListener('click', () => openServiceModal());

  const btnAddCustom = document.getElementById('btnAddCustomSetting');
  if (btnAddCustom) btnAddCustom.addEventListener('click', () => {
    document.getElementById('modalAddCustomSetting')?.classList.add('open');
  });

  // Modal Closers
  document.querySelectorAll('.modal-close-trigger').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) closeAllModals(); });
  });

  // SVG Hotspots click
  document.querySelectorAll('.sensor-pin').forEach(node => {
    node.addEventListener('click', () => {
      const key = node.getAttribute('data-key');
      openMaintenanceDrawer(key);
    });
  });

  // Quick Sim buttons
  document.getElementById('btnSimSpeedSpike')?.addEventListener('click', () => {
    demoSimulator.setSpeed(95);
    showToast('Simulasi: Kecepatan dinaikkan ke 95 km/h (Over-Speed)!', 'warning');
  });
  document.getElementById('btnSimNormalSpeed')?.addEventListener('click', () => {
    demoSimulator.setSpeed(55);
    showToast('Simulasi: Kecepatan normal 55 km/h.', 'success');
  });
  document.getElementById('btnSimOdoWarning')?.addEventListener('click', () => {
    demoSimulator.setOdo(99650);
    showToast('Simulasi: Odo diset ke 99,650 km (Mendekati jadwal servis)!', 'warning');
  });
  document.getElementById('btnSimOdoDue')?.addEventListener('click', () => {
    demoSimulator.setOdo(100500);
    showToast('Simulasi: Odo diset ke 100,500 km (Jatuh tempo servis)!', 'warning');
  });
}

function openMaintenanceDrawer(focusKey = null) {
  document.getElementById('drawerBackdrop')?.classList.add('open');
  if (focusKey) {
    switchDrawerTab('tab-schedules');
    setTimeout(() => {
      const card = document.getElementById(`card-${focusKey}`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }
}

function closeMaintenanceDrawer() {
  document.getElementById('drawerBackdrop')?.classList.remove('open');
}

function switchDrawerTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === tabId));
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
}

function populateServiceModalDropdown() {
  const select = document.getElementById('serviceTypeSelect');
  const historyFilter = document.getElementById('historyFilterSelect');
  if (!select) return;

  const settings = maintenanceEngine.settings;
  const options = Object.keys(settings).map(k => `<option value="${k}">${settings[k].name}</option>`).join('');
  select.innerHTML = options;
  if (historyFilter) historyFilter.innerHTML = `<option value="ALL">Semua Komponen</option>` + options;
}

function openServiceModal(preselectKey = null, preselectName = null) {
  const modal = document.getElementById('modalAddService');
  if (!modal) return;

  const typeSelect = document.getElementById('serviceTypeSelect');
  const odoInput = document.getElementById('serviceOdoInput');
  const dateInput = document.getElementById('serviceDateInput');

  if (typeSelect && preselectKey) typeSelect.value = preselectKey;
  if (odoInput) odoInput.value = Math.round(currentOdo);
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  document.querySelectorAll('.part-checkbox').forEach(cb => {
    cb.checked = Boolean(preselectName && cb.value.toLowerCase().includes(preselectName.toLowerCase()));
  });

  modal.classList.add('open');
}

async function handleServiceFormSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('serviceTypeSelect').value;
  const odo = document.getElementById('serviceOdoInput').value;
  const date = document.getElementById('serviceDateInput').value;
  const notes = document.getElementById('serviceNotesInput').value;
  
  const items = [];
  document.querySelectorAll('.part-checkbox:checked').forEach(cb => items.push(cb.value));

  await maintenanceEngine.logService({ type, odo: Number(odo), date, notes, items });
  closeAllModals();
  renderMaintenanceCards();
  renderServiceHistory();
  renderDashboardHealth();
  showToast('Catatan servis berhasil disimpan!', 'success');
}

async function handleCustomSettingSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('customNameInput').value.trim();
  const intervalKm = Number(document.getElementById('customKmInput').value);
  const intervalMonths = Number(document.getElementById('customMonthsInput').value);
  const reminderKm = Number(document.getElementById('customRemKmInput').value);
  const reminderDays = Number(document.getElementById('customRemDaysInput').value);

  if (!name) return;
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

  await maintenanceEngine.updateSetting(key, {
    name,
    category: "custom",
    intervalKm,
    intervalMonths,
    reminderKm,
    reminderDays,
    sensorNodeId: "node-engine"
  });

  closeAllModals();
  populateServiceModalDropdown();
  renderSettingsList();
  renderMaintenanceCards();
  renderDashboardHealth();
  showToast(`Komponen "${name}" berhasil ditambahkan!`, 'success');
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
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
