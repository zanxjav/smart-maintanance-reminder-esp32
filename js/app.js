/**
 * VEHICLE SCADA DASHBOARD - MAIN APPLICATION CONTROLLER
 * 
 * Orchestrates telemetry updates, gauge animations, SCADA car node pulses,
 * maintenance drawer, modal workflows, service logging, and settings management.
 */

import { initFirebaseService, subscribeVehicleData, subscribeSpeedLimit, subscribeMaintenanceSettings, subscribeMaintenanceStatus, subscribeServiceHistory, isFirebaseActive } from './firebase.js';
import { maintenanceEngine } from './maintenance-engine.js';
import { demoSimulator } from './demo-simulator.js';

// Global state cache
let currentSpeed = 72;
let currentSpeedLimit = 60;
let currentOdo = 97245;
let currentTrip = 124.6;
let currentGps = "CONNECTED";
let currentEsp32 = "ONLINE";
let activeFilter = "ALL";

document.addEventListener('DOMContentLoaded', async () => {
  initClock();
  setupUIEvents();

  // Initialize Firebase service or Demo Mode
  const initResult = await initFirebaseService();
  updateConnectionBadge(initResult.status);

  // Subscribe to vehicle data stream
  subscribeVehicleData((data) => {
    handleVehicleDataUpdate(data);
  });

  // Subscribe to speed limit
  subscribeSpeedLimit((limit) => {
    if (limit) {
      currentSpeedLimit = Number(limit);
      updateSpeedLimitDisplay(currentSpeedLimit);
    }
  });

  // Subscribe to maintenance updates
  subscribeMaintenanceStatus((mState) => {
    renderDashboardHealth();
    renderMaintenanceCards();
  });

  // Subscribe to service history
  subscribeServiceHistory((historyList) => {
    renderServiceHistory();
  });

  // If not Firebase connected, run demo simulation loop
  if (!isFirebaseActive()) {
    demoSimulator.start();
  }

  // Initial UI Render
  renderDashboardHealth();
  renderMaintenanceCards();
  renderServiceHistory();
  renderSettingsList();
  populateServiceModalDropdown();
});

/* ==========================================================================
   TOP BAR CLOCK & CONNECTION STATUS
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
    label.textContent = 'FIREBASE CONNECTED';
  } else {
    badge.className = 'status-badge demo-mode';
    label.textContent = 'DEMO MODE';
  }
}

/* ==========================================================================
   TELEMETRY & SPEED HUD UPDATES
   ========================================================================== */
function handleVehicleDataUpdate(data) {
  if (!data) return;

  // Speed
  currentSpeed = Number(data.speed) || 0;
  currentOdo = Number(data.odo) || currentOdo;
  currentTrip = Number(data.trip) || currentTrip;
  currentGps = data.gps || currentGps;
  currentEsp32 = data.esp32 || currentEsp32;

  // Update DOM Elements
  const speedEl = document.getElementById('valSpeed');
  if (speedEl) speedEl.textContent = currentSpeed;

  const odoEl = document.getElementById('valOdo');
  if (odoEl) odoEl.textContent = maintenanceEngine.formatNumber(currentOdo);

  const tripEl = document.getElementById('valTrip');
  if (tripEl) tripEl.textContent = Number(currentTrip).toFixed(1);

  const lastUpdateEl = document.getElementById('valLastUpdate');
  if (lastUpdateEl) lastUpdateEl.textContent = data.lastUpdate || data.time || "-";

  const latLongEl = document.getElementById('valGpsCoords');
  if (latLongEl && data.latitude && data.longitude) {
    latLongEl.textContent = `${data.latitude}, ${data.longitude}`;
  }

  // Update GPS & ESP32 badges in Top Bar
  const gpsBadge = document.getElementById('gpsStatusBadge');
  const gpsText = document.getElementById('gpsStatusText');
  if (gpsBadge && gpsText) {
    gpsText.textContent = `GPS: ${currentGps}`;
    gpsBadge.className = `status-badge ${currentGps === 'CONNECTED' ? 'connected' : 'disconnected'}`;
  }

  const espBadge = document.getElementById('espStatusBadge');
  const espText = document.getElementById('espStatusText');
  if (espBadge && espText) {
    espText.textContent = `ESP32: ${currentEsp32}`;
    espBadge.className = `status-badge ${currentEsp32 === 'ONLINE' ? 'online' : 'offline'}`;
  }

  // Speed Gauge Circular Arc (Max speed 200 km/h)
  const maxSpeed = 200;
  const clampedSpeed = Math.min(maxSpeed, Math.max(0, currentSpeed));
  const arcLength = 283; // Circumference of radius 90 semi-arc
  const offset = arcLength - (clampedSpeed / maxSpeed) * arcLength;

  const gaugeFill = document.getElementById('speedGaugeFill');
  if (gaugeFill) {
    gaugeFill.style.strokeDashoffset = offset;
  }

  // Speed Limit Warning Handling (Requirement 8)
  const speedCard = document.getElementById('speedHudCard');
  const warningBanner = document.getElementById('speedWarningBanner');
  const bannerSpeedVal = document.getElementById('bannerCurrentSpeed');
  const bannerLimitVal = document.getElementById('bannerLimitSpeed');

  if (currentSpeed > currentSpeedLimit) {
    if (speedCard) speedCard.classList.add('over-limit');
    if (warningBanner) {
      warningBanner.classList.add('active');
      if (bannerSpeedVal) bannerSpeedVal.textContent = `${currentSpeed} KM/H`;
      if (bannerLimitVal) bannerLimitVal.textContent = `${currentSpeedLimit} KM/H`;
    }
  } else {
    if (speedCard) speedCard.classList.remove('over-limit');
    if (warningBanner) warningBanner.classList.remove('active');
  }

  // Keep maintenance engine in sync with odometer
  maintenanceEngine.setCurrentOdo(currentOdo);
  renderDashboardHealth();
}

function updateSpeedLimitDisplay(limit) {
  const limitEls = document.querySelectorAll('.val-speed-limit');
  limitEls.forEach(el => el.textContent = `${limit} KM/H`);
}

/* ==========================================================================
   DASHBOARD HEALTH & SCADA VEHICLE HOTSPOTS
   ========================================================================== */
function renderDashboardHealth() {
  const summary = maintenanceEngine.recalculateAllStatuses();

  // Summary counts
  const normalCountEl = document.getElementById('summaryCountNormal');
  const warningCountEl = document.getElementById('summaryCountWarning');
  const dueCountEl = document.getElementById('summaryCountDue');

  if (normalCountEl) normalCountEl.textContent = summary.normal;
  if (warningCountEl) warningCountEl.textContent = summary.warning;
  if (dueCountEl) dueCountEl.textContent = summary.due;

  // Render quick list of critical/warning items on right panel
  const keyListContainer = document.getElementById('keyItemsList');
  if (keyListContainer) {
    const allCards = maintenanceEngine.getAllCardsData();
    keyListContainer.innerHTML = allCards.map(item => `
      <div class="key-item-row" data-key="${item.key}">
        <span class="key-item-name">${item.name}</span>
        <span class="key-item-status-pill ${item.status.toLowerCase()}">${item.status}</span>
      </div>
    `).join('');

    // Clicking a key item opens maintenance drawer
    keyListContainer.querySelectorAll('.key-item-row').forEach(row => {
      row.addEventListener('click', () => {
        const key = row.dataset.key;
        openMaintenanceDrawer(key);
      });
    });
  }

  // Update SCADA Car SVG Node colors
  updateScadaCarPins();
}

function updateScadaCarPins() {
  const allCards = maintenanceEngine.getAllCardsData();
  
  allCards.forEach(item => {
    if (item.sensorNodeId) {
      const nodeEl = document.getElementById(item.sensorNodeId);
      if (nodeEl) {
        nodeEl.className.baseVal = `scada-node node-status-${item.status.toLowerCase()}`;
        nodeEl.setAttribute('data-key', item.key);
      }
    }
  });
}

/* ==========================================================================
   MAINTENANCE CARDS RENDERING (Drawer Tab 1)
   ========================================================================== */
function renderMaintenanceCards() {
  const container = document.getElementById('maintenanceCardsContainer');
  if (!container) return;

  const items = maintenanceEngine.getAllCardsData();
  const filtered = activeFilter === 'ALL' ? items : items.filter(i => i.status === activeFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>No maintenance items matching status: <strong>${activeFilter}</strong></p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const statusClass = `status-${item.status.toLowerCase()}`;
    const intervalMonthsStr = `${item.intervalMonths} BULAN`;
    const intervalKmStr = `${maintenanceEngine.formatNumber(item.intervalKm)} KM`;

    return `
      <div class="m-card ${statusClass}" id="card-${item.key}">
        <div class="m-card-header">
          <div class="m-card-title-wrap">
            <h4 class="m-card-title">${item.name.toUpperCase()}</h4>
          </div>
          <span class="m-card-badge">${item.status}</span>
        </div>

        <div class="m-card-info-grid">
          <div class="m-info-block">
            <span class="m-info-label">INTERVAL</span>
            <span class="m-info-val-primary">${intervalKmStr}</span>
            <span class="m-info-val-sub">${intervalMonthsStr}</span>
          </div>

          <div class="m-info-block">
            <span class="m-info-label">LAST SERVICE</span>
            <span class="m-info-val-primary">${maintenanceEngine.formatNumber(item.lastServiceOdo)} KM</span>
            <span class="m-info-val-sub">${maintenanceEngine.formatDisplayDate(item.lastServiceDate)}</span>
          </div>

          <div class="m-info-block">
            <span class="m-info-label">NEXT SERVICE</span>
            <span class="m-info-val-primary">${maintenanceEngine.formatNumber(item.nextServiceOdo)} KM</span>
            <span class="m-info-val-sub">${maintenanceEngine.formatDisplayDate(item.nextServiceDate)}</span>
          </div>
        </div>

        <div class="m-progress-container">
          <div class="m-progress-meta">
            <span>HEALTH DEGRADATION</span>
            <span><strong>${item.progressPercent}%</strong> (${item.kmLeft > 0 ? `${maintenanceEngine.formatNumber(item.kmLeft)} KM REMAINING` : 'OVERDUE'})</span>
          </div>
          <div class="m-progress-track">
            <div class="m-progress-fill" style="width: ${item.progressPercent}%"></div>
          </div>
        </div>

        <div class="m-card-footer">
          <button class="btn-card-action btn-edit-schedule" data-key="${item.key}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Schedule
          </button>
          <button class="btn-card-action log-service btn-log-single" data-key="${item.key}" data-name="${item.name}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Log Service
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Event Listeners for Log Service and Edit Schedule
  container.querySelectorAll('.btn-log-single').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openServiceModal(btn.dataset.key, btn.dataset.name);
    });
  });

  container.querySelectorAll('.btn-edit-schedule').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      switchDrawerTab('tab-settings');
      setTimeout(() => {
        const settingCard = document.getElementById(`setting-card-${btn.dataset.key}`);
        if (settingCard) {
          settingCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          settingCard.style.borderColor = 'var(--neon-cyan)';
          setTimeout(() => settingCard.style.borderColor = '', 2000);
        }
      }, 150);
    });
  });
}

/* ==========================================================================
   SERVICE HISTORY TIMELINE (Drawer Tab 2)
   ========================================================================== */
function renderServiceHistory() {
  const container = document.getElementById('historyTimelineContainer');
  if (!container) return;

  const history = maintenanceEngine.history;
  const historyFilter = document.getElementById('historyFilterSelect')?.value || 'ALL';
  
  const filtered = historyFilter === 'ALL' ? history : history.filter(h => h.type === historyFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 14 14"/>
        </svg>
        <p>No service records recorded yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="history-item">
      <div class="history-item-dot"></div>
      <div class="history-card">
        <div class="history-header">
          <h4 class="history-title">${item.typeName || "Vehicle Service"}</h4>
          <div class="history-date-odo">
            <span>📅 ${maintenanceEngine.formatDisplayDate(item.date)}</span>
            <span>⚡ ${maintenanceEngine.formatNumber(item.odo)} KM</span>
          </div>
        </div>

        <div class="history-items-tags">
          ${(item.items || []).map(tag => `<span class="history-tag">✓ ${tag}</span>`).join('')}
        </div>

        ${item.notes ? `<div class="history-notes"><strong>Catatan:</strong> ${escapeHtml(item.notes)}</div>` : ''}

        ${item.photoProof ? `
          <img src="${item.photoProof}" alt="Service Proof" class="history-photo-preview" onclick="openPhotoViewer('${item.photoProof}')">
        ` : ''}
      </div>
    </div>
  `).join('');
}

/* ==========================================================================
   SETTINGS LIST (Drawer Tab 3)
   ========================================================================== */
function renderSettingsList() {
  const container = document.getElementById('settingsListContainer');
  if (!container) return;

  const settings = maintenanceEngine.settings;

  container.innerHTML = Object.keys(settings).map(key => {
    const s = settings[key];
    return `
      <div class="settings-item-card" id="setting-card-${key}">
        <div class="settings-item-header">
          <h4 class="settings-item-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--neon-cyan)" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            ${s.name.toUpperCase()}
          </h4>
          <button class="btn-card-action btn-save-setting" data-key="${key}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            Save Setting
          </button>
        </div>

        <div class="settings-inputs-grid">
          <div class="input-group">
            <label class="input-label">INTERVAL KM</label>
            <input type="number" class="input-control" id="input-km-${key}" value="${s.intervalKm}" step="500">
          </div>

          <div class="input-group">
            <label class="input-label">INTERVAL BULAN</label>
            <input type="number" class="input-control" id="input-months-${key}" value="${s.intervalMonths}" min="1">
          </div>

          <div class="input-group">
            <label class="input-label">REMINDER KM</label>
            <input type="number" class="input-control" id="input-rem-km-${key}" value="${s.reminderKm || 500}">
          </div>

          <div class="input-group">
            <label class="input-label">REMINDER HARI</label>
            <input type="number" class="input-control" id="input-rem-days-${key}" value="${s.reminderDays || 7}">
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Attach Save events
  container.querySelectorAll('.btn-save-setting').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key;
      const intervalKm = document.getElementById(`input-km-${key}`).value;
      const intervalMonths = document.getElementById(`input-months-${key}`).value;
      const reminderKm = document.getElementById(`input-rem-km-${key}`).value;
      const reminderDays = document.getElementById(`input-rem-days-${key}`).value;

      await maintenanceEngine.updateSetting(key, {
        intervalKm,
        intervalMonths,
        reminderKm,
        reminderDays
      });

      showToast(`Interval ${maintenanceEngine.settings[key].name} berhasil diperbarui!`, 'success');
      renderMaintenanceCards();
      renderDashboardHealth();
    });
  });
}

/* ==========================================================================
   DRAWER & MODAL LIFECYCLE & EVENTS
   ========================================================================== */
function setupUIEvents() {
  // Check Maintenance CTA Button
  const btnCheck = document.getElementById('btnCheckMaintenance');
  if (btnCheck) {
    btnCheck.addEventListener('click', () => openMaintenanceDrawer());
  }

  // Close Drawer
  const btnCloseDrawer = document.getElementById('btnCloseDrawer');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeMaintenanceDrawer);
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', (e) => {
      if (e.target === drawerBackdrop) closeMaintenanceDrawer();
    });
  }

  // Drawer Tabs switching
  const tabBtns = document.querySelectorAll('.drawer-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      switchDrawerTab(targetTab);
    });
  });

  // Maintenance Status Filter dropdown in Drawer
  const filterSelect = document.getElementById('maintenanceStatusFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      activeFilter = e.target.value;
      renderMaintenanceCards();
    });
  }

  // History Filter dropdown
  const historyFilter = document.getElementById('historyFilterSelect');
  if (historyFilter) {
    historyFilter.addEventListener('change', () => renderServiceHistory());
  }

  // "Add Service" Button inside Drawer
  const btnAddService = document.getElementById('btnOpenAddServiceModal');
  if (btnAddService) {
    btnAddService.addEventListener('click', () => openServiceModal());
  }

  // "Add Custom Maintenance" in Settings
  const btnAddCustomSetting = document.getElementById('btnAddCustomSetting');
  if (btnAddCustomSetting) {
    btnAddCustomSetting.addEventListener('click', () => openCustomSettingModal());
  }

  // Form Submissions
  const formService = document.getElementById('formAddService');
  if (formService) {
    formService.addEventListener('submit', handleServiceFormSubmit);
  }

  const formCustomSetting = document.getElementById('formAddCustomSetting');
  if (formCustomSetting) {
    formCustomSetting.addEventListener('submit', handleCustomSettingSubmit);
  }

  // Modal Closers
  document.querySelectorAll('.modal-close-trigger').forEach(btn => {
    btn.addEventListener('click', () => closeAllModals());
  });

  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAllModals();
    });
  });

  // SVG Vehicle Hotspots clicks
  document.querySelectorAll('.scada-node').forEach(node => {
    node.addEventListener('click', () => {
      const key = node.getAttribute('data-key');
      openMaintenanceDrawer(key);
    });
  });

  // Simulation Controls & Speed spike tester
  setupSimulationModalEvents();
}

function openMaintenanceDrawer(focusKey = null) {
  const backdrop = document.getElementById('drawerBackdrop');
  if (backdrop) backdrop.classList.add('open');

  if (focusKey) {
    switchDrawerTab('tab-schedules');
    setTimeout(() => {
      const card = document.getElementById(`card-${focusKey}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.boxShadow = '0 0 30px var(--neon-cyan)';
        setTimeout(() => card.style.boxShadow = '', 2000);
      }
    }, 200);
  }
}

function closeMaintenanceDrawer() {
  const backdrop = document.getElementById('drawerBackdrop');
  if (backdrop) backdrop.classList.remove('open');
}

function switchDrawerTab(tabId) {
  document.querySelectorAll('.drawer-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
}

/* ==========================================================================
   SERVICE RECORD FORM & SUBMISSION (Requirement 13)
   ========================================================================== */
function populateServiceModalDropdown() {
  const select = document.getElementById('serviceTypeSelect');
  const historyFilter = document.getElementById('historyFilterSelect');
  if (!select) return;

  const settings = maintenanceEngine.settings;
  const options = Object.keys(settings).map(k => `
    <option value="${k}">${settings[k].name}</option>
  `).join('');

  select.innerHTML = options;

  if (historyFilter) {
    historyFilter.innerHTML = `<option value="ALL">All Maintenance Types</option>` + options;
  }
}

function openServiceModal(preselectKey = null, preselectName = null) {
  const modal = document.getElementById('modalAddService');
  if (!modal) return;

  const typeSelect = document.getElementById('serviceTypeSelect');
  const odoInput = document.getElementById('serviceOdoInput');
  const dateInput = document.getElementById('serviceDateInput');
  const notesInput = document.getElementById('serviceNotesInput');
  const photoInput = document.getElementById('servicePhotoInput');
  const photoPreview = document.getElementById('photoPreviewContainer');

  if (typeSelect && preselectKey) typeSelect.value = preselectKey;
  if (odoInput) odoInput.value = Math.round(currentOdo);
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  if (notesInput) notesInput.value = '';
  if (photoInput) photoInput.value = '';
  if (photoPreview) photoPreview.innerHTML = '';

  // Auto-check the relevant checkbox
  document.querySelectorAll('.part-checkbox').forEach(cb => {
    cb.checked = (preselectName && cb.value.toLowerCase().includes(preselectName.toLowerCase()));
  });

  modal.classList.add('open');
}

async function handleServiceFormSubmit(e) {
  e.preventDefault();

  const type = document.getElementById('serviceTypeSelect').value;
  const odo = document.getElementById('serviceOdoInput').value;
  const date = document.getElementById('serviceDateInput').value;
  const notes = document.getElementById('serviceNotesInput').value;
  
  // Selected parts
  const items = [];
  document.querySelectorAll('.part-checkbox:checked').forEach(cb => {
    items.push(cb.value);
  });

  // Handle Photo File safely
  const photoInput = document.getElementById('servicePhotoInput');
  let photoProof = "";
  if (photoInput && photoInput.files && photoInput.files[0]) {
    try {
      photoProof = await readFileAsBase64(photoInput.files[0]);
    } catch (err) {
      console.warn("Photo upload preview fallback:", err);
    }
  }

  // Log Service
  await maintenanceEngine.logService({
    type,
    odo: Number(odo),
    date,
    notes,
    items,
    photoProof
  });

  closeAllModals();
  renderMaintenanceCards();
  renderServiceHistory();
  renderDashboardHealth();
  showToast('Service record berhasil disimpan & jadwal otomatis diperbarui!', 'success');
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ==========================================================================
   CUSTOM MAINTENANCE ITEM MODAL & FORM (Requirement 15)
   ========================================================================== */
function openCustomSettingModal() {
  const modal = document.getElementById('modalAddCustomSetting');
  if (modal) modal.classList.add('open');
}

async function handleCustomSettingSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('customNameInput').value.trim();
  const intervalKm = document.getElementById('customKmInput').value;
  const intervalMonths = document.getElementById('customMonthsInput').value;
  const reminderKm = document.getElementById('customRemKmInput').value;
  const reminderDays = document.getElementById('customRemDaysInput').value;

  if (!name) return;

  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '_');

  await maintenanceEngine.updateSetting(key, {
    name,
    category: "custom",
    intervalKm: Number(intervalKm),
    intervalMonths: Number(intervalMonths),
    reminderKm: Number(reminderKm),
    reminderDays: Number(reminderDays),
    sensorNodeId: "node-engine"
  });

  closeAllModals();
  populateServiceModalDropdown();
  renderSettingsList();
  renderMaintenanceCards();
  renderDashboardHealth();
  showToast(`Custom maintenance "${name}" berhasil ditambahkan!`, 'success');
}

/* ==========================================================================
   SIMULATION CONTROLS & TESTER MODAL
   ========================================================================== */
function setupSimulationModalEvents() {
  const btnOpenSim = document.getElementById('btnOpenSimModal');
  const modalSim = document.getElementById('modalSimControls');
  if (btnOpenSim && modalSim) {
    btnOpenSim.addEventListener('click', () => {
      document.getElementById('simSpeedInput').value = currentSpeed;
      document.getElementById('simLimitInput').value = currentSpeedLimit;
      document.getElementById('simOdoInput').value = Math.round(currentOdo);
      modalSim.classList.add('open');
    });
  }

  // Quick Action Buttons on right panel
  const btnQuickSpike = document.getElementById('btnSimSpeedSpike');
  if (btnQuickSpike) {
    btnQuickSpike.addEventListener('click', () => {
      demoSimulator.setSpeed(95);
      showToast('Simulasi: Kecepatan dinaikkan ke 95 KM/H (Melebihi Speed Limit 60 KM/H)!', 'warning');
    });
  }

  const btnQuickCruise = document.getElementById('btnSimNormalSpeed');
  if (btnQuickCruise) {
    btnQuickCruise.addEventListener('click', () => {
      demoSimulator.setSpeed(55);
      showToast('Simulasi: Kecepatan dinormalkan ke 55 KM/H.', 'success');
    });
  }

  const btnSimOdoWarning = document.getElementById('btnSimOdoWarning');
  if (btnSimOdoWarning) {
    btnSimOdoWarning.addEventListener('click', () => {
      demoSimulator.setOdo(99650);
      showToast('Simulasi: Odometer diset ke 99,650 KM (Memicu Reminder Warning)!', 'warning');
    });
  }

  const btnSimOdoDue = document.getElementById('btnSimOdoDue');
  if (btnSimOdoDue) {
    btnSimOdoDue.addEventListener('click', () => {
      demoSimulator.setOdo(100500);
      showToast('Simulasi: Odometer diset ke 100,500 KM (Memicu Status DUE Overdue)!', 'error');
    });
  }

  // Simulation form save
  const formSim = document.getElementById('formSimControls');
  if (formSim) {
    formSim.addEventListener('submit', (e) => {
      e.preventDefault();
      const speed = Number(document.getElementById('simSpeedInput').value);
      const limit = Number(document.getElementById('simLimitInput').value);
      const odo = Number(document.getElementById('simOdoInput').value);
      const gps = document.getElementById('simGpsSelect').value;
      const esp = document.getElementById('simEspSelect').value;

      demoSimulator.setSpeed(speed);
      demoSimulator.setSpeedLimit(limit);
      demoSimulator.setOdo(odo);
      demoSimulator.setGpsStatus(gps);
      demoSimulator.setEsp32Status(esp);

      closeAllModals();
      showToast('Pengaturan simulasi berhasil diterapkan.', 'success');
    });
  }
}

/* ==========================================================================
   TOAST NOTIFICATIONS
   ========================================================================== */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '⚡';
  if (type === 'success') icon = '✓';
  if (type === 'warning') icon = '⚠';
  if (type === 'error') icon = '✕';

  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.openPhotoViewer = (src) => {
  const modal = document.getElementById('modalPhotoViewer');
  const img = document.getElementById('photoViewerImg');
  if (modal && img) {
    img.src = src;
    modal.classList.add('open');
  }
};
