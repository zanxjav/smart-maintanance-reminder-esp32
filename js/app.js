/**
 * VEHICLE MONITOR - ULTRA FAST APP CONTROLLER (BULLETPROOF 60FPS)
 * 
 * Guaranteed execution on all devices with direct global handlers + delegated events.
 */

import { 
  initFirebaseRealtime,
  subscribeVehicleData, 
  subscribeSpeedLimit, 
  subscribeConnectionStatus,
  subscribeFlashTest,
  subscribeDisplayMode,
  writeSpeedLimit, 
  writeResetTrip,
  writeFlashTest,
  writeDisplayMode
} from './telemetry-service.js';
import { maintenanceEngine } from './maintenance-engine.js';

let currentSpeed = 0;
let currentSpeedLimit = 60;
let currentOdo = 97248;
let currentTrip = 0;
let currentStatus = "Normal";
let currentOledMode = 0; // 0 = Speedo HUD, 1 = Full Clock

/* ==========================================================================
   GLOBAL EXPORTED CONTROLLERS (DIRECT ONCLICK ACCESSIBILITY)
   ========================================================================== */

export function openAddMaintenanceModal() {
  const modal = document.getElementById('modalAddMaintenance');
  if (!modal) return;

  const odoInput = document.getElementById('addMaintLastOdo');
  const dateInput = document.getElementById('addMaintLastDate');
  const nameInput = document.getElementById('addMaintName');

  if (odoInput) odoInput.value = Math.round(currentOdo);
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  if (nameInput) nameInput.value = '';

  document.querySelectorAll('.chip-preset-item').forEach(c => c.classList.remove('active'));
  modal.classList.add('open');
}

export function openMaintenanceManager() {
  renderMaintenanceReminders();
  const modal = document.getElementById('modalMaintenanceManager');
  if (modal) modal.classList.add('open');
}

export function closeAllModals() {
  document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
}

export function switchOledMode(mode) {
  currentOledMode = Number(mode) === 1 ? 1 : 0;
  const btnSpeedo = document.getElementById('btnOledModeSpeedo');
  const btnClock = document.getElementById('btnOledModeClock');
  const badgeEl = document.getElementById('oledActiveBadge');
  const descEl = document.getElementById('oledModeDesc');

  if (btnSpeedo) btnSpeedo.classList.toggle('active', currentOledMode === 0);
  if (btnClock) btnClock.classList.toggle('active', currentOledMode === 1);

  if (badgeEl) {
    badgeEl.textContent = currentOledMode === 1 ? 'Jam Full 🕒' : 'Mode Biasa';
    badgeEl.style.background = currentOledMode === 1 ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.15)';
    badgeEl.style.color = currentOledMode === 1 ? '#c084fc' : '#38bdf8';
    badgeEl.style.borderColor = currentOledMode === 1 ? 'rgba(168, 85, 247, 0.4)' : 'rgba(56, 189, 248, 0.3)';
  }

  if (descEl) {
    descEl.textContent = currentOledMode === 1 
      ? 'Tampilan: Jam Digital Ekstra Besar (Full Screen)' 
      : 'Tampilan: Dashboard Speedometer & Info Kendaraan';
  }

  writeDisplayMode(currentOledMode);
  showToast(currentOledMode === 1 ? 'Layar OLED diset ke: Jam Full Layar 🕒' : 'Layar OLED diset ke: Mode Biasa (Speedometer)', 'info');
}

export function openEditIntervalModal(id) {
  const modal = document.getElementById('modalEditInterval');
  if (!modal) return;

  const item = maintenanceEngine.items.find(i => i.id === id);
  if (!item) return;

  const titleEl = document.getElementById('editIntervalTitle');
  const keyInput = document.getElementById('editIntervalKey');
  const kmInput = document.getElementById('editIntervalKm');
  const moInput = document.getElementById('editIntervalMonths');

  if (titleEl) titleEl.textContent = `Ubah Interval: ${item.name}`;
  if (keyInput) keyInput.value = id;
  if (kmInput) kmInput.value = item.intervalKm;
  if (moInput) moInput.value = item.intervalMonths;

  document.querySelectorAll('.btn-preset-km').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.val) === Number(item.intervalKm));
  });
  document.querySelectorAll('.btn-preset-mo').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.val) === Number(item.intervalMonths));
  });

  modal.classList.add('open');
}

export function openDeleteConfirmModal(id, name) {
  const modal = document.getElementById('modalConfirmDelete');
  if (!modal) return;

  const idInput = document.getElementById('deleteTargetKey');
  const nameEl = document.getElementById('deleteTargetName');

  if (idInput) idInput.value = id;
  if (nameEl) nameEl.textContent = name;

  modal.classList.add('open');
}

export function openServiceModal(preselectId = null) {
  const modal = document.getElementById('modalAddService');
  if (!modal) return;

  populateServiceModalDropdown();

  const typeSelect = document.getElementById('serviceTypeSelect');
  const odoInput = document.getElementById('serviceOdoInput');
  const dateInput = document.getElementById('serviceDateInput');

  if (typeSelect && preselectId) typeSelect.value = preselectId;
  if (odoInput) odoInput.value = Math.round(currentOdo);
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  modal.classList.add('open');
}

// Bind to window for direct HTML onclick support
window.openAddMaintenanceModal = openAddMaintenanceModal;
window.openMaintenanceManager = openMaintenanceManager;
window.closeAllModals = closeAllModals;
window.switchOledMode = switchOledMode;
window.openEditIntervalModal = openEditIntervalModal;
window.openDeleteConfirmModal = openDeleteConfirmModal;
window.openServiceModal = openServiceModal;

/* ==========================================================================
   INITIALIZATION ROUTINE
   ========================================================================== */

function initApp() {
  initClock();
  setupUIEvents();
  setupFlashTestController();
  setupOledModeController();
  setupSpeedLimiterModal();
  setupAddMaintenanceModal();
  setupEditIntervalModal();
  setupDeleteModal();
  setupConnectionModal();
  populateServiceModalDropdown();
  
  maintenanceEngine.setCurrentOdo(currentOdo);
  renderMaintenanceReminders();
  updateRedlineArc(currentSpeedLimit);
  updateAnalogNeedle(0, currentSpeedLimit);
  handleVehicleDataUpdate({ speed: 0, rawSpeed: 0, odo: currentOdo, trip: currentTrip, status: currentStatus });

  // Start Telemetry
  initFirebaseRealtime();

  // Subscriptions (Ultra clean, no recursion)
  subscribeVehicleData((data) => {
    handleVehicleDataUpdate(data);
  });

  subscribeSpeedLimit((limit) => {
    if (limit !== null && limit !== undefined) {
      currentSpeedLimit = Number(limit);
      updateSpeedLimitDisplay(currentSpeedLimit);
    }
  });

  subscribeConnectionStatus((status) => {
    updateConnectionBadge(status.connected);
  });

  subscribeDisplayMode((mode) => {
    const m = Number(mode) === 1 ? 1 : 0;
    if (m !== currentOledMode) {
      currentOledMode = m;
      const btnSpeedo = document.getElementById('btnOledModeSpeedo');
      const btnClock = document.getElementById('btnOledModeClock');
      const badgeEl = document.getElementById('oledActiveBadge');
      const descEl = document.getElementById('oledModeDesc');

      if (btnSpeedo) btnSpeedo.classList.toggle('active', currentOledMode === 0);
      if (btnClock) btnClock.classList.toggle('active', currentOledMode === 1);
      if (badgeEl) {
        badgeEl.textContent = currentOledMode === 1 ? 'Jam Full 🕒' : 'Mode Biasa';
        badgeEl.style.background = currentOledMode === 1 ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.15)';
        badgeEl.style.color = currentOledMode === 1 ? '#c084fc' : '#38bdf8';
        badgeEl.style.borderColor = currentOledMode === 1 ? 'rgba(168, 85, 247, 0.4)' : 'rgba(56, 189, 248, 0.3)';
      }
      if (descEl) {
        descEl.textContent = currentOledMode === 1 
          ? 'Tampilan: Jam Digital Ekstra Besar (Full Screen)' 
          : 'Tampilan: Dashboard Speedometer & Info Kendaraan';
      }
    }
  });
}

// Immediate execution guarantee for ES Modules
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

/* ==========================================================================
   TOP CLOCK FORMATTING
   ========================================================================== */

function initClock() {
  const clockEl = document.getElementById('liveClockText');
  const update = () => {
    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
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
   SUPER SMOOTH TELEMETRY UPDATES (OPTIMIZED DOM WRITES)
   ========================================================================== */
let lastDisplayedSpeed = -1;
let lastDisplayedOdo = -1;
let lastDisplayedTrip = -1;

function handleVehicleDataUpdate(data) {
  if (!data) return;

  const rawSpd = Number(data.rawSpeed !== undefined ? data.rawSpeed : data.speed) || 0;
  currentSpeed = rawSpd < 2.5 ? 0 : rawSpd;
  currentOdo = (Number(data.odo) > 0) ? Number(data.odo) : currentOdo;
  currentTrip = Number(data.trip) || currentTrip;
  currentStatus = data.status || currentStatus;

  // Cached DOM writes for speed
  const roundedSpeed = Math.round(currentSpeed);
  if (roundedSpeed !== lastDisplayedSpeed) {
    lastDisplayedSpeed = roundedSpeed;
    const speedValEl = document.getElementById('valSpeed');
    const speedLargeEl = document.getElementById('valSpeedLarge');
    if (speedValEl) speedValEl.textContent = roundedSpeed;
    if (speedLargeEl) speedLargeEl.textContent = roundedSpeed;

    updateAnalogNeedle(currentSpeed, currentSpeedLimit);

    const actDot = document.getElementById('recentActivityDot');
    const actTitle = document.getElementById('recentActivityTitle');
    const actSub = document.getElementById('recentActivitySub');
    const actTime = document.getElementById('recentActivityTime');

    if (currentSpeed > currentSpeedLimit) {
      if (actDot) actDot.className = 'activity-dot red';
      if (actTitle) actTitle.textContent = 'Speed Alert';
      if (actSub) actSub.textContent = `Overspeed: ${roundedSpeed} km/h`;
      if (actTime) actTime.textContent = 'Just now';
    }
  }

  // Cached DOM writes for ODO
  const roundedOdo = Math.round(currentOdo);
  if (roundedOdo !== lastDisplayedOdo && roundedOdo > 0) {
    lastDisplayedOdo = roundedOdo;
    const odoEl = document.getElementById('valOdo');
    if (odoEl) odoEl.textContent = maintenanceEngine.formatNumber(roundedOdo);
    maintenanceEngine.setCurrentOdo(roundedOdo);
    renderMaintenanceReminders();
  }

  // Cached DOM writes for Trip
  const tripNum = Number(currentTrip) || 0;
  const formattedTrip = tripNum < 10 ? tripNum.toFixed(2) : tripNum.toFixed(1);
  if (formattedTrip !== lastDisplayedTrip) {
    lastDisplayedTrip = formattedTrip;
    const tripEl = document.getElementById('valTrip');
    if (tripEl) tripEl.textContent = formattedTrip;
  }
}

/**
 * Dynamic 2D Redline Arc based on configured Speed Limit
 */
export function updateRedlineArc(speedLimitVal) {
  const maxScale = 140;
  const limit = Math.min(135, Math.max(20, Number(speedLimitVal) || 60));
  const redlineArc = document.getElementById('speedRedlineArc');
  const badgeEl = document.getElementById('analogSpeedLimitBadge');

  if (badgeEl) {
    badgeEl.textContent = `LIMIT ${limit} KM/H`;
  }

  if (redlineArc) {
    const startAngleDeg = 180 - (limit / maxScale) * 180;
    const startAngleRad = startAngleDeg * (Math.PI / 180);

    const cx = 140, cy = 100, r = 85;
    const x1 = cx + r * Math.cos(startAngleRad);
    const y1 = cy - r * Math.sin(startAngleRad);
    const x2 = cx + r;
    const y2 = cy;

    redlineArc.setAttribute('d', `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2} ${y2}`);
  }
}

/**
 * Update Flat 2D Needle rotation & warning styling
 */
export function updateAnalogNeedle(speed, limit) {
  const maxScale = 140;
  const clampedSpeed = Math.min(maxScale, Math.max(0, speed));
  const rotationDeg = -90 + (clampedSpeed / maxScale) * 180;

  const needleGroup = document.getElementById('analogNeedleGroup');
  const needleBody = document.getElementById('speedNeedleBody');
  const needleCenterDot = document.getElementById('needleCenterDot');
  const speedValEl = document.getElementById('valSpeed');
  const speedLargeEl = document.getElementById('valSpeedLarge');
  const redlineArc = document.getElementById('speedRedlineArc');

  if (needleGroup) {
    needleGroup.style.transform = `rotate(${rotationDeg.toFixed(1)}deg)`;
  }

  const isOverSpeed = speed > limit;
  if (isOverSpeed) {
    if (needleBody) {
      needleBody.setAttribute('fill', '#ef4444');
      needleBody.style.filter = 'drop-shadow(0 0 8px #ef4444)';
    }
    if (needleCenterDot) needleCenterDot.setAttribute('stroke', '#ef4444');
    if (speedValEl) speedValEl.style.color = '#ef4444';
    if (speedLargeEl) speedLargeEl.style.color = '#ef4444';
    if (redlineArc) {
      redlineArc.style.stroke = '#ef4444';
      redlineArc.style.filter = 'drop-shadow(0 0 10px #ef4444)';
    }
  } else {
    if (needleBody) {
      needleBody.setAttribute('fill', '#38bdf8');
      needleBody.style.filter = 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.75))';
    }
    if (needleCenterDot) needleCenterDot.setAttribute('stroke', '#38bdf8');
    if (speedValEl) speedValEl.style.color = '#ffffff';
    if (speedLargeEl) speedLargeEl.style.color = '#ffffff';
    if (redlineArc) {
      redlineArc.style.stroke = '#ef4444';
      redlineArc.style.filter = 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))';
    }
  }
}

function updateSpeedLimitDisplay(limit) {
  const display = document.getElementById('valSpeedLimitDisplay');
  if (display) display.textContent = `${limit} km/h`;
  updateRedlineArc(limit);
}

/* ==========================================================================
   MAINTENANCE REMINDERS RENDERING (100% DYNAMIC & LIGHTWEIGHT)
   ========================================================================== */
function renderMaintenanceReminders() {
  const { cards, summary } = maintenanceEngine.getAllCardsData();

  // 1. Vehicle status badge in 2x2 grid
  const statusBadge = document.getElementById('valVehicleStatus');
  const statusSub = document.getElementById('statusSummarySubText');
  if (statusBadge) {
    if (summary.due > 0) {
      statusBadge.textContent = 'Due Service';
      statusBadge.style.background = '#fef2f2';
      statusBadge.style.color = '#ef4444';
      if (statusSub) statusSub.textContent = `${summary.due} komponen perlu diservis`;
    } else if (summary.warning > 0) {
      statusBadge.textContent = 'Warning';
      statusBadge.style.background = '#fffbeb';
      statusBadge.style.color = '#f59e0b';
      if (statusSub) statusSub.textContent = `${summary.warning} komponen mendekati jadwal`;
    } else {
      statusBadge.textContent = 'Normal';
      statusBadge.style.background = '#ecfdf5';
      statusBadge.style.color = '#10b981';
      if (statusSub) statusSub.textContent = 'All systems operational';
    }
  }

  // 2. Count badge in header
  const countBadge = document.getElementById('mActiveCountBadge');
  if (countBadge) {
    countBadge.textContent = `${cards.length} Komponen`;
  }

  // 3. Dynamic Rendering of Dashboard Maintenance List
  const dashContainer = document.getElementById('maintenanceListContainer');
  if (dashContainer) {
    if (cards.length === 0) {
      dashContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: #94a3b8; background: #131b2e; border: 1px dashed rgba(255,255,255,0.12); border-radius: 14px;">
          <p style="font-weight: 600; font-size: 0.9rem; color: #cbd5e1;">Belum ada komponen maintenance.</p>
          <p style="font-size: 0.78rem; margin-top: 4px; color: #94a3b8;">Klik bar "+ Add Maintenance Baru" di atas untuk menambahkan.</p>
        </div>
      `;
    } else {
      dashContainer.innerHTML = cards.map(item => {
        const pct = item.progressPercent;
        const statusClass = item.status.toLowerCase();
        const statusLabel = item.status === 'DUE' ? 'Due Service' : (item.status === 'WARNING' ? 'Warning' : 'Normal');

        let barColor = '#10b981';
        if (item.status === 'DUE') barColor = '#ef4444';
        else if (item.status === 'WARNING') barColor = '#f59e0b';

        return `
          <div class="m-row-item" data-id="${item.id}" onclick="openServiceModal('${item.id}')">
            <div class="m-card-top">
              <div class="m-left-group">
                <div class="m-icon-box ${item.colorClass}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    ${item.iconSvg}
                  </svg>
                </div>
                <div class="m-text-info">
                  <div style="display: flex; align-items: center; gap: 0.4rem;">
                    <span class="m-name">${item.name}</span>
                    <span class="m-category-pill ${item.colorClass}">${item.categoryLabel}</span>
                  </div>
                  <span class="m-sub">Setiap ${maintenanceEngine.formatNumber(item.intervalKm)} km / ${item.intervalMonths} bln</span>
                </div>
              </div>
              <div class="m-right-group">
                <span class="m-pct-pill">${pct}%</span>
                <span class="m-arrow">›</span>
              </div>
            </div>

            <div class="m-card-bottom">
              <div class="m-progress-labels">
                <span class="m-remaining-text">${item.kmLeft > 0 ? `${maintenanceEngine.formatNumber(item.kmLeft)} km lagi` : 'Jatuh tempo!'}</span>
                <span class="m-status-tag ${statusClass}">${statusLabel}</span>
              </div>
              <div class="m-bar-track">
                <div class="m-bar-fill" style="width: ${pct}%; background: ${barColor};"></div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 4. Dynamic Rendering in Full Maintenance Manager Modal
  const fullContainer = document.getElementById('fullMaintenanceListContainer');
  if (fullContainer) {
    if (cards.length === 0) {
      fullContainer.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: #94a3b8; background: #1e293b; border: 1px dashed rgba(255,255,255,0.15); border-radius: 14px;">
          <p style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">Daftar Perawatan Masih Kosong</p>
          <p style="font-size: 0.8rem; margin: 6px 0 14px; color: #94a3b8;">Tambahkan komponen kendaraan untuk mulai memantau.</p>
          <button type="button" class="btn-pri" onclick="closeAllModals(); openAddMaintenanceModal();" style="padding: 0.5rem 1.1rem; font-size: 0.82rem; background: linear-gradient(135deg, #10b981, #059669);">+ Tambah Maintenance Sekarang</button>
        </div>
      `;
    } else {
      fullContainer.innerHTML = cards.map(item => {
        const pct = item.progressPercent;
        const statusLabel = item.status === 'DUE' ? 'DUE SERVICE' : (item.status === 'WARNING' ? 'WARNING' : 'NORMAL');
        const statusBg = item.status === 'DUE' ? 'rgba(239,68,68,0.18)' : (item.status === 'WARNING' ? 'rgba(245,158,11,0.18)' : 'rgba(16,185,129,0.18)');
        const statusColor = item.status === 'DUE' ? '#ef4444' : (item.status === 'WARNING' ? '#f59e0b' : '#10b981');

        let barColor = '#10b981';
        if (item.status === 'DUE') barColor = '#ef4444';
        else if (item.status === 'WARNING') barColor = '#f59e0b';

        return `
          <div class="modal-service-card" data-id="${item.id}" style="background: #1e293b; border: 1px solid rgba(255,255,255,0.12); padding: 1rem 1.1rem; border-radius: 14px; display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div class="m-icon-box ${item.colorClass}" style="width: 36px; height: 36px; border-radius: 10px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width: 18px; height: 18px;">
                    ${item.iconSvg}
                  </svg>
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                    <span style="font-weight: 700; font-size: 0.95rem; color: #ffffff;">${item.name}</span>
                    <span class="m-category-pill ${item.colorClass}">${item.categoryLabel}</span>
                  </div>
                  <div style="font-size: 0.76rem; color: #94a3b8; margin-top: 3px;">
                    Interval: <strong style="color: #38bdf8;">${maintenanceEngine.formatNumber(item.intervalKm)} KM</strong> / <strong style="color: #38bdf8;">${item.intervalMonths} Bulan</strong>
                  </div>
                  <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 1px;">
                    Servis Berikutnya: <span style="color: #cbd5e1; font-weight: 600;">${maintenanceEngine.formatNumber(item.nextServiceOdo)} KM</span> (${maintenanceEngine.formatDisplayDate(item.nextServiceDate)})
                  </div>
                </div>
              </div>
              
              <div style="text-align: right; flex-shrink: 0;">
                <span style="font-weight: 700; font-size: 0.72rem; padding: 0.2rem 0.55rem; border-radius: 6px; background: ${statusBg}; color: ${statusColor};">${statusLabel}</span>
                <div style="font-size: 0.76rem; font-weight: 700; color: #cbd5e1; margin-top: 4px;">
                  ${item.kmLeft > 0 ? `${maintenanceEngine.formatNumber(item.kmLeft)} KM lagi` : '<span style="color:#ef4444;">Jatuh tempo!</span>'}
                </div>
              </div>
            </div>

            <!-- Progress bar -->
            <div style="display: flex; flex-direction: column; gap: 0.3rem;">
              <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #94a3b8;">
                <span>Progres Pemakaian:</span>
                <span style="font-weight: 700; color: ${statusColor};">${pct}%</span>
              </div>
              <div class="m-bar-track" style="height: 5px;">
                <div class="m-bar-fill" style="width: ${pct}%; background: ${barColor};"></div>
              </div>
            </div>

            <!-- Action buttons: Edit Interval, Log Service, Delete -->
            <div style="display: flex; gap: 0.45rem; justify-content: flex-end; align-items: center; padding-top: 0.45rem; border-top: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap;">
              <button type="button" class="btn-sec btn-edit-interval-item" onclick="closeAllModals(); openEditIntervalModal('${item.id}');" style="padding: 0.35rem 0.7rem; font-size: 0.75rem; border-radius: 8px;">⚙️ Ubah Interval</button>
              <button type="button" class="btn-pri btn-log-service-item" onclick="closeAllModals(); openServiceModal('${item.id}');" style="padding: 0.35rem 0.8rem; font-size: 0.75rem; border-radius: 8px;">+ Catat Servis</button>
              <button type="button" class="btn-del-item" onclick="closeAllModals(); openDeleteConfirmModal('${item.id}', '${item.name.replace(/'/g, "\\'")}');" title="Hapus Komponen" aria-label="Hapus Komponen">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>Hapus</span>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

/* ==========================================================================
   DELEGATED UI EVENTS & BOTTOM TAB BAR (100% BULLETPROOF)
   ========================================================================== */
function setupUIEvents() {
  // Document-level delegated click listener
  document.addEventListener('click', (e) => {
    // 1. Add Maintenance bar button or manager add button
    const addBtn = e.target.closest('#btnOpenAddMaintenanceQuick, #btnOpenAddMaintenanceFromManager');
    if (addBtn) {
      e.preventDefault();
      closeAllModals();
      openAddMaintenanceModal();
      return;
    }

    // 2. View All Maintenance trigger
    const viewAllBtn = e.target.closest('#btnViewAllMaintenance');
    if (viewAllBtn) {
      e.preventDefault();
      openMaintenanceManager();
      return;
    }

    // 3. OLED Mode Speedo button
    const oledSpeedo = e.target.closest('#btnOledModeSpeedo');
    if (oledSpeedo) {
      e.preventDefault();
      switchOledMode(0);
      return;
    }

    // 4. OLED Mode Clock button
    const oledClock = e.target.closest('#btnOledModeClock');
    if (oledClock) {
      e.preventDefault();
      switchOledMode(1);
      return;
    }

    // 5. Modal Closer buttons
    const closeBtn = e.target.closest('.modal-close-trigger');
    if (closeBtn) {
      e.preventDefault();
      closeAllModals();
      return;
    }

    // 6. Backdrop click to close
    if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
      closeAllModals();
      return;
    }
  });

  // Bottom Tab Navigation
  const tabs = document.querySelectorAll('.nav-tab-item');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabName = tab.dataset.tab;
      if (tabName === 'trip') {
        writeResetTrip();
        showToast('Trip meter berhasil direset ke 0.0 km', 'success');
        setTimeout(() => {
          document.getElementById('tabNavDashboard')?.classList.add('active');
          tab.classList.remove('active');
        }, 1200);
      } else if (tabName === 'maintenance') {
        openMaintenanceManager();
      } else if (tabName === 'settings') {
        document.getElementById('modalSpeedLimit')?.classList.add('open');
      }
    });
  });

  // Add Service Form trigger
  document.getElementById('btnOpenAddServiceForm')?.addEventListener('click', () => {
    closeAllModals();
    openServiceModal();
  });

  const formService = document.getElementById('formAddService');
  if (formService) formService.addEventListener('submit', handleServiceFormSubmit);

  // Notifications button
  document.getElementById('btnNotifications')?.addEventListener('click', () => {
    showToast('Semua sensor dan sistem kendaraan normal terkoneksi.', 'success');
  });

  document.getElementById('btnMenu')?.addEventListener('click', () => {
    openMaintenanceManager();
  });

  // Recent Activity View All
  document.getElementById('btnViewAllActivity')?.addEventListener('click', () => {
    showToast('Tidak ada alert aktif lainnya.', 'info');
  });
}

function populateServiceModalDropdown() {
  const select = document.getElementById('serviceTypeSelect');
  if (!select) return;
  const items = maintenanceEngine.items;
  if (items.length === 0) {
    select.innerHTML = `<option value="">-- Tidak ada komponen (Tambah dulu) --</option>`;
    return;
  }
  select.innerHTML = items.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
}

function handleServiceFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('serviceTypeSelect').value;
  const odo = document.getElementById('serviceOdoInput').value;
  const date = document.getElementById('serviceDateInput').value;
  const notes = document.getElementById('serviceNotesInput').value;

  if (!id) {
    showToast('Pilih komponen terlebih dahulu.', 'warning');
    return;
  }

  closeAllModals();
  maintenanceEngine.recordService(id, Number(odo), date, notes);
  renderMaintenanceReminders();
  showToast('Catatan servis berhasil disimpan!', 'success');
}

/* ==========================================================================
   ADD MAINTENANCE FORM CONTROLLER (INSTANT 0MS SAVE)
   ========================================================================== */
function setupAddMaintenanceModal() {
  const form = document.getElementById('formAddMaintenance');
  const nameInput = document.getElementById('addMaintName');
  const catSelect = document.getElementById('addMaintCategory');
  const kmInput = document.getElementById('addMaintIntervalKm');
  const moInput = document.getElementById('addMaintIntervalMonths');
  const odoInput = document.getElementById('addMaintLastOdo');
  const dateInput = document.getElementById('addMaintLastDate');
  const reminderInput = document.getElementById('addMaintReminderKm');

  // Preset chips delegation
  document.getElementById('addPresetChipsList')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip-preset-item');
    if (!chip) return;
    document.querySelectorAll('.chip-preset-item').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    if (nameInput && chip.dataset.name) nameInput.value = chip.dataset.name;
    if (catSelect && chip.dataset.cat) catSelect.value = chip.dataset.cat;
    if (kmInput && chip.dataset.km) {
      kmInput.value = chip.dataset.km;
      document.querySelectorAll('.btn-add-km-pre').forEach(b => {
        b.classList.toggle('active', b.dataset.val === chip.dataset.km);
      });
    }
    if (moInput && chip.dataset.mo) {
      moInput.value = chip.dataset.mo;
      document.querySelectorAll('.btn-add-mo-pre').forEach(b => {
        b.classList.toggle('active', b.dataset.val === chip.dataset.mo);
      });
    }
  });

  // Preset buttons
  document.querySelectorAll('.btn-add-km-pre').forEach(btn => {
    btn.addEventListener('click', () => {
      if (kmInput) kmInput.value = btn.dataset.val;
      document.querySelectorAll('.btn-add-km-pre').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  document.querySelectorAll('.btn-add-mo-pre').forEach(btn => {
    btn.addEventListener('click', () => {
      if (moInput) moInput.value = btn.dataset.val;
      document.querySelectorAll('.btn-add-mo-pre').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // Form submit handler (Instant 0ms Save)
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = nameInput.value.trim();
      if (!name) {
        showToast('Mohon masukkan nama komponen.', 'warning');
        return;
      }

      const category = catSelect.value;
      const intervalKm = Number(kmInput.value) || 10000;
      const intervalMonths = Number(moInput.value) || 6;
      const lastServiceOdo = Number(odoInput.value) || currentOdo;
      const lastServiceDate = dateInput.value || new Date().toISOString().split('T')[0];
      const reminderKm = Number(reminderInput.value) || 500;

      closeAllModals();

      // Instant in-memory + localStorage save
      maintenanceEngine.addItem({
        name,
        category,
        intervalKm,
        intervalMonths,
        lastServiceOdo,
        lastServiceDate,
        reminderKm
      });

      populateServiceModalDropdown();
      renderMaintenanceReminders();

      showToast(`Komponen "${name}" berhasil ditambahkan!`, 'success');
    });
  }
}

/* ==========================================================================
   DELETE MAINTENANCE ITEM CONTROLLER
   ========================================================================== */
function setupDeleteModal() {
  const confirmBtn = document.getElementById('btnConfirmDeleteAction');
  if (!confirmBtn) return;

  confirmBtn.addEventListener('click', () => {
    const id = document.getElementById('deleteTargetKey')?.value;
    if (!id) return;

    const item = maintenanceEngine.items.find(i => i.id === id);
    const itemName = item ? item.name : 'Komponen';

    closeAllModals();

    maintenanceEngine.deleteItem(id);

    populateServiceModalDropdown();
    renderMaintenanceReminders();

    showToast(`"${itemName}" telah berhasil dihapus.`, 'info');
  });
}

/* ==========================================================================
   EDIT INTERVAL CONTROLLER (SUPER FAST & SMOOTH)
   ========================================================================== */
function setupEditIntervalModal() {
  const form = document.getElementById('formEditInterval');
  const kmInput = document.getElementById('editIntervalKm');
  const moInput = document.getElementById('editIntervalMonths');

  document.querySelectorAll('.btn-preset-km').forEach(btn => {
    btn.addEventListener('click', () => {
      if (kmInput) kmInput.value = btn.dataset.val;
      document.querySelectorAll('.btn-preset-km').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  document.querySelectorAll('.btn-preset-mo').forEach(btn => {
    btn.addEventListener('click', () => {
      if (moInput) moInput.value = btn.dataset.val;
      document.querySelectorAll('.btn-preset-mo').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('editIntervalKey').value;
      const intervalKm = Number(kmInput.value) || 10000;
      const intervalMonths = Number(moInput.value) || 6;

      const item = maintenanceEngine.updateInterval(id, intervalKm, intervalMonths);
      const itemName = item ? item.name : 'Komponen';

      closeAllModals();
      renderMaintenanceReminders();

      showToast(`Interval ${itemName} diubah ke ${maintenanceEngine.formatNumber(intervalKm)} KM / ${intervalMonths} Bulan!`, 'success');
    });
  }
}

/* ==========================================================================
   SPEED LIMITER CONTROLLER
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
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const newLimit = Number(slider.value);
      currentSpeedLimit = newLimit;
      writeSpeedLimit(newLimit);
      updateSpeedLimitDisplay(newLimit);
      closeAllModals();
      showToast(`Speed limit diset ke ${newLimit} km/h`, 'success');
      handleVehicleDataUpdate({ speed: currentSpeed, odo: currentOdo, trip: currentTrip });
    });
  }
}

/* ==========================================================================
   OLED DISPLAY MODE CONTROLLER
   ========================================================================== */
function setupOledModeController() {
  const btnSpeedo = document.getElementById('btnOledModeSpeedo');
  const btnClock = document.getElementById('btnOledModeClock');

  btnSpeedo?.addEventListener('click', () => switchOledMode(0));
  btnClock?.addEventListener('click', () => switchOledMode(1));
}

function updateConnectionBadge(connected) {
  const dot = document.getElementById('esp32Dot');
  const label = document.getElementById('esp32StatusLabel');
  if (dot && label) {
    if (connected) {
      dot.className = 'status-indicator-dot online';
      label.textContent = 'Live Telemetry';
    } else {
      dot.className = 'status-indicator-dot offline';
      label.textContent = 'Standby';
    }
  }
}

function setupConnectionModal() {
  const btn = document.getElementById('btnEsp32Status');
  if (btn) {
    btn.addEventListener('click', () => {
      showToast('Sistem Telemetri Kendaraan SCADA Aktif.', 'info');
    });
  }
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
    toast.style.transform = 'translateY(10px) scale(0.95)';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

/* ==========================================================================
   FLASH TEST CONTROLLER
   ========================================================================== */
let isFlashTestActive = false;
let flashTestCountdownTimer = null;
let flashRemainingSeconds = 0;

function playFlashBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {}
}

function setupFlashTestController() {
  const cardEl = document.getElementById('flashTestCard');
  const btnEl = document.getElementById('btnFlashTest');
  const badgeEl = document.getElementById('flashStatusBadge');
  const descEl = document.getElementById('flashDescText');
  const iconEl = document.getElementById('btnFlashIcon');
  const labelEl = document.getElementById('btnFlashLabel');

  if (!btnEl) return;

  const stopFlashTest = (showToastNotice = true) => {
    if (flashTestCountdownTimer) {
      clearInterval(flashTestCountdownTimer);
      flashTestCountdownTimer = null;
    }
    isFlashTestActive = false;
    flashRemainingSeconds = 0;

    if (cardEl) cardEl.classList.remove('is-flashing');
    if (badgeEl) {
      badgeEl.textContent = 'Standby';
      badgeEl.className = 'flash-status-badge';
    }
    if (descEl) descEl.textContent = 'Uji kedipan lampu indikator warning (Pin 4)';
    if (iconEl) iconEl.textContent = '⚡';
    if (labelEl) labelEl.textContent = 'Test Flash';

    writeFlashTest(false, 0);

    if (showToastNotice) {
      showToast('Flash Test selesai. Lampu indikator standby.', 'info');
    }
  };

  const startFlashTest = (durationSec = 5) => {
    if (flashTestCountdownTimer) {
      clearInterval(flashTestCountdownTimer);
    }
    isFlashTestActive = true;
    flashRemainingSeconds = durationSec;

    if (cardEl) cardEl.classList.add('is-flashing');
    if (badgeEl) {
      badgeEl.textContent = `⚡ Flashing ${flashRemainingSeconds}s`;
    }
    if (descEl) descEl.textContent = 'Lampu oren Pin 4 sedang berkedip (300ms cycle)...';
    if (iconEl) iconEl.textContent = '✕';
    if (labelEl) labelEl.textContent = `Stop (${flashRemainingSeconds}s)`;

    playFlashBeep();
    showToast(`⚡ Flash Test Aktif (${durationSec}s): Menguji kedipan lampu oren...`, 'warning');
    writeFlashTest(true, durationSec * 1000);

    flashTestCountdownTimer = setInterval(() => {
      flashRemainingSeconds--;
      if (flashRemainingSeconds > 0) {
        if (badgeEl) badgeEl.textContent = `⚡ Flashing ${flashRemainingSeconds}s`;
        if (labelEl) labelEl.textContent = `Stop (${flashRemainingSeconds}s)`;
        playFlashBeep();
      } else {
        stopFlashTest(true);
      }
    }, 1000);
  };

  btnEl.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFlashTestActive) {
      stopFlashTest(true);
    } else {
      startFlashTest(5);
    }
  });

  subscribeFlashTest((payload) => {
    if (!payload) return;
    if (payload.active && !isFlashTestActive) {
      const dur = Math.max(1, Math.round((payload.duration || 5000) / 1000));
      startFlashTest(dur);
    } else if (!payload.active && isFlashTestActive) {
      stopFlashTest(false);
    }
  });
}
