/**
 * VEHICLE MONITOR - STANDALONE ULTRA-FAST ENGINE & APP CONTROLLER
 * 
 * 100% Standalone, Zero Dependency, 0ms UI Latency, Direct DOM Control.
 */

// ==========================================================================
// CONSTANTS & CONFIGURATION
// ==========================================================================
const FIREBASE_DB_URL = 'https://vehicle-monitor-esp32-default-rtdb.asia-southeast1.firebasedatabase.app';
const STORAGE_MAINT_ITEMS = 'vmon_maintenance_items_v3';
const STORAGE_SERVICE_HISTORY = 'vmon_service_history_v3';
const STORAGE_SPEED_LIMIT = 'vehicle_scada_speed_limit';
const STORAGE_DISPLAY_MODE = 'vehicle_oled_display_mode';

// Default clean initial items
const DEFAULT_ITEMS = [
  {
    id: 'maint_oli_mesin',
    name: 'Oli Mesin',
    category: 'engine',
    intervalKm: 10000,
    intervalMonths: 6,
    lastServiceOdo: 97248,
    lastServiceDate: '2026-08-28',
    reminderKm: 500
  },
  {
    id: 'maint_kampas_rem',
    name: 'Kampas Rem',
    category: 'brakes',
    intervalKm: 30000,
    intervalMonths: 18,
    lastServiceOdo: 97248,
    lastServiceDate: '2026-08-28',
    reminderKm: 1000
  }
];

// App State
let currentSpeed = 0;
let currentSpeedLimit = 60;
let currentOdo = 97248;
let currentTrip = 0;
let currentStatus = "Normal";
let currentOledMode = 0; // 0 = Speedo HUD, 1 = Full Clock
let isConnected = false;
let lastDataTime = 0;
let eventSource = null;
let maintenanceItems = loadMaintenanceItems();
let serviceHistory = loadServiceHistory();

// Clean legacy bloated keys
(function cleanLegacyStorage() {
  try {
    const legacyKeys = [
      'scada_maintenance_settings',
      'scada_maintenance_state',
      'scada_service_history',
      'vehicle_scada_maintenance_settings',
      'vehicle_scada_service_history',
      'vmon_maintenance_items_v2',
      'vmon_service_history_v2'
    ];
    legacyKeys.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
})();

function loadMaintenanceItems() {
  try {
    const data = localStorage.getItem(STORAGE_MAINT_ITEMS);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_ITEMS));
}

function saveMaintenanceItems() {
  try {
    localStorage.setItem(STORAGE_MAINT_ITEMS, JSON.stringify(maintenanceItems));
  } catch (e) {}
}

function loadServiceHistory() {
  try {
    const data = localStorage.getItem(STORAGE_SERVICE_HISTORY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function saveServiceHistory() {
  try {
    localStorage.setItem(STORAGE_SERVICE_HISTORY, JSON.stringify(serviceHistory));
  } catch (e) {}
}

// Category Information Helper
function getCategoryInfo(cat) {
  const category = (cat || 'general').toLowerCase();
  switch (category) {
    case 'engine':
      return { label: 'Mesin', colorClass: 'green', iconSvg: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>' };
    case 'transmission':
      return { label: 'Transmisi', colorClass: 'orange', iconSvg: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>' };
    case 'cooling':
      return { label: 'Pendingin', colorClass: 'purple', iconSvg: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>' };
    case 'brakes':
      return { label: 'Pengereman', colorClass: 'red', iconSvg: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><line x1="12" y1="3" x2="12" y2="7"/>' };
    case 'electrical':
      return { label: 'Kelistrikan', colorClass: 'yellow', iconSvg: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' };
    case 'wheels':
      return { label: 'Roda & Ban', colorClass: 'blue', iconSvg: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/>' };
    default:
      return { label: 'Umum', colorClass: 'blue', iconSvg: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' };
  }
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return Number(num).toLocaleString('id-ID');
}

function addMonthsToDate(dateStr, months) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr || '-';
    d.setMonth(d.getMonth() + parseInt(months || 6, 10));
    return d.toISOString().split('T')[0];
  } catch (e) {
    return dateStr || '-';
  }
}

function formatDisplayDate(dateStr) {
  if (!dateStr || dateStr === '-') return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch (e) {
    return dateStr;
  }
}

// Toast notification
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
    setTimeout(() => {
      if (typeof toast.remove === 'function') toast.remove();
      else if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }, 2500);
}

// ==========================================================================
// MODAL CONTROLLERS (DIRECT DOM DISPLAY + ZERO INTERCEPTION)
// ==========================================================================

function closeAllModals() {
  const modals = document.querySelectorAll('.modal-backdrop');
  modals.forEach(m => {
    m.style.setProperty('display', 'none', 'important');
    m.classList.remove('open');
  });
}

function openModalById(modalId) {
  closeAllModals();
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.setProperty('display', 'flex', 'important');
    modal.classList.add('open');
  }
}

function openAddMaintenanceModal() {
  const odoInput = document.getElementById('addMaintLastOdo');
  const dateInput = document.getElementById('addMaintLastDate');
  const nameInput = document.getElementById('addMaintName');

  if (odoInput) odoInput.value = Math.round(currentOdo);
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  if (nameInput) nameInput.value = '';

  document.querySelectorAll('.chip-preset-item').forEach(c => c.classList.remove('active'));
  openModalById('modalAddMaintenance');
}

function openMaintenanceManager() {
  renderMaintenanceReminders();
  openModalById('modalMaintenanceManager');
}

function openEditIntervalModal(id) {
  const item = maintenanceItems.find(i => i.id === id);
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

  openModalById('modalEditInterval');
}

function openDeleteConfirmModal(id, name) {
  const idInput = document.getElementById('deleteTargetKey');
  const nameEl = document.getElementById('deleteTargetName');

  if (idInput) idInput.value = id;
  if (nameEl) nameEl.textContent = name || 'Komponen';

  openModalById('modalConfirmDelete');
}

function populateServiceModalDropdown() {
  const select = document.getElementById('serviceTypeSelect');
  if (!select) return;
  if (maintenanceItems.length === 0) {
    select.innerHTML = `<option value="">-- Tidak ada komponen (Tambah dulu) --</option>`;
    return;
  }
  select.innerHTML = maintenanceItems.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
}

function openServiceModal(preselectId = null) {
  populateServiceModalDropdown();

  const typeSelect = document.getElementById('serviceTypeSelect');
  const odoInput = document.getElementById('serviceOdoInput');
  const dateInput = document.getElementById('serviceDateInput');

  if (typeSelect && preselectId) typeSelect.value = preselectId;
  if (odoInput) odoInput.value = Math.round(currentOdo);
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  openModalById('modalAddService');
}

function openSpeedLimitModal() {
  const slider = document.getElementById('speedLimitRange');
  const sliderVal = document.getElementById('speedLimitSliderVal');
  if (slider) slider.value = currentSpeedLimit;
  if (sliderVal) sliderVal.textContent = currentSpeedLimit;
  document.querySelectorAll('.btn-pre').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.val) === currentSpeedLimit);
  });
  openModalById('modalSpeedLimit');
}

// ==========================================================================
// OLED DISPLAY MODE SWITCHER (DIRECT REALTIME CLOUD COMMAND)
// ==========================================================================

function switchOledMode(mode) {
  currentOledMode = Number(mode) === 1 ? 1 : 0;
  try {
    localStorage.setItem(STORAGE_DISPLAY_MODE, currentOledMode.toString());
  } catch (e) {}

  const btnSpeedo = document.getElementById('btnOledModeSpeedo');
  const btnClock = document.getElementById('btnOledModeClock');
  const badgeEl = document.getElementById('oledActiveBadge');
  const descEl = document.getElementById('oledModeDesc');

  if (btnSpeedo) {
    btnSpeedo.classList.toggle('active', currentOledMode === 0);
  }
  if (btnClock) {
    btnClock.classList.toggle('active', currentOledMode === 1);
  }
  if (badgeEl) {
    badgeEl.textContent = currentOledMode === 1 ? 'Jam Full 🕒' : 'Mode Biasa';
    badgeEl.style.background = currentOledMode === 1 ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.15)';
    badgeEl.style.color = currentOledMode === 1 ? '#c084fc' : '#38bdf8';
  }
  if (descEl) {
    descEl.textContent = currentOledMode === 1 
      ? 'Tampilan: Jam Digital Ekstra Besar (Full Screen)' 
      : 'Tampilan: Dashboard Speedometer & Info Kendaraan';
  }

  // Non-blocking sync to Firebase Realtime Database
  fetch(`${FIREBASE_DB_URL}/settings/displayMode.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(currentOledMode)
  }).catch(() => {});

  fetch(`${FIREBASE_DB_URL}/commands/displayMode.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: currentOledMode, name: currentOledMode === 1 ? 'FULL_CLOCK' : 'SPEEDO_HUD', timestamp: Date.now() })
  }).catch(() => {});

  showToast(currentOledMode === 1 ? 'Layar OLED diset ke: Jam Full Layar 🕒' : 'Layar OLED diset ke: Mode Biasa (Speedometer)', 'info');
}

// ==========================================================================
// RENDER MAINTENANCE CARDS (DASHBOARD & MANAGER)
// ==========================================================================

function renderMaintenanceReminders() {
  const odo = currentOdo;
  let dueCount = 0;
  let warningCount = 0;

  const cards = maintenanceItems.map(item => {
    const catInfo = getCategoryInfo(item.category);
    const lastOdo = Number(item.lastServiceOdo) || 0;
    const intervalKm = Number(item.intervalKm) || 10000;
    const nextServiceOdo = lastOdo + intervalKm;
    const nextServiceDate = addMonthsToDate(item.lastServiceDate, item.intervalMonths);
    
    const kmCovered = Math.max(0, odo - lastOdo);
    const kmLeft = Math.max(0, nextServiceOdo - odo);
    const progressPercent = Math.max(0, Math.min(100, Math.round((kmCovered / intervalKm) * 100)));

    let status = 'NORMAL';
    if (odo >= nextServiceOdo) {
      status = 'DUE';
      dueCount++;
    } else if (kmLeft <= (item.reminderKm || 500)) {
      status = 'WARNING';
      warningCount++;
    }

    return {
      ...item,
      categoryLabel: catInfo.label,
      colorClass: catInfo.colorClass,
      iconSvg: catInfo.iconSvg,
      nextServiceOdo,
      nextServiceDate,
      kmLeft,
      progressPercent,
      status
    };
  });

  // 1. Vehicle status badge
  const statusBadge = document.getElementById('valVehicleStatus');
  const statusSub = document.getElementById('statusSummarySubText');
  if (statusBadge) {
    if (dueCount > 0) {
      statusBadge.textContent = 'Due Service';
      statusBadge.style.background = '#fef2f2';
      statusBadge.style.color = '#ef4444';
      if (statusSub) statusSub.textContent = `${dueCount} komponen perlu diservis`;
    } else if (warningCount > 0) {
      statusBadge.textContent = 'Warning';
      statusBadge.style.background = '#fffbeb';
      statusBadge.style.color = '#f59e0b';
      if (statusSub) statusSub.textContent = `${warningCount} komponen mendekati jadwal`;
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

  // 3. Dashboard Container
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
                  <span class="m-sub">Setiap ${formatNumber(item.intervalKm)} km / ${item.intervalMonths} bln</span>
                </div>
              </div>
              <div class="m-right-group">
                <span class="m-pct-pill">${pct}%</span>
                <span class="m-arrow">›</span>
              </div>
            </div>

            <div class="m-card-bottom">
              <div class="m-progress-labels">
                <span class="m-remaining-text">${item.kmLeft > 0 ? `${formatNumber(item.kmLeft)} km lagi` : 'Jatuh tempo!'}</span>
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

  // 4. Full Manager Container
  const fullContainer = document.getElementById('fullMaintenanceListContainer');
  if (fullContainer) {
    if (cards.length === 0) {
      fullContainer.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: #94a3b8; background: #1e293b; border: 1px dashed rgba(255,255,255,0.15); border-radius: 14px;">
          <p style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">Daftar Perawatan Masih Kosong</p>
          <p style="font-size: 0.8rem; margin: 6px 0 14px; color: #94a3b8;">Tambahkan komponen kendaraan untuk mulai memantau.</p>
          <button type="button" class="btn-pri" onclick="openAddMaintenanceModal();" style="padding: 0.5rem 1.1rem; font-size: 0.82rem; background: linear-gradient(135deg, #10b981, #059669);">+ Tambah Maintenance Sekarang</button>
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
                    Interval: <strong style="color: #38bdf8;">${formatNumber(item.intervalKm)} KM</strong> / <strong style="color: #38bdf8;">${item.intervalMonths} Bulan</strong>
                  </div>
                  <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 1px;">
                    Servis Berikutnya: <span style="color: #cbd5e1; font-weight: 600;">${formatNumber(item.nextServiceOdo)} KM</span> (${formatDisplayDate(item.nextServiceDate)})
                  </div>
                </div>
              </div>
              
              <div style="text-align: right; flex-shrink: 0;">
                <span style="font-weight: 700; font-size: 0.72rem; padding: 0.2rem 0.55rem; border-radius: 6px; background: ${statusBg}; color: ${statusColor};">${statusLabel}</span>
                <div style="font-size: 0.76rem; font-weight: 700; color: #cbd5e1; margin-top: 4px;">
                  ${item.kmLeft > 0 ? `${formatNumber(item.kmLeft)} KM lagi` : '<span style="color:#ef4444;">Jatuh tempo!</span>'}
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
              <button type="button" class="btn-sec" onclick="openEditIntervalModal('${item.id}');" style="padding: 0.35rem 0.7rem; font-size: 0.75rem; border-radius: 8px;">⚙️ Ubah Interval</button>
              <button type="button" class="btn-pri" onclick="openServiceModal('${item.id}');" style="padding: 0.35rem 0.8rem; font-size: 0.75rem; border-radius: 8px;">+ Catat Servis</button>
              <button type="button" class="btn-del-item" onclick="openDeleteConfirmModal('${item.id}', '${item.name.replace(/'/g, "\\'")}');" title="Hapus Komponen" aria-label="Hapus Komponen">
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

// ==========================================================================
// FORM SUBMIT HANDLERS (0MS ULTRA-FAST SAVE)
// ==========================================================================

function handleAddMaintenanceSubmit(e) {
  if (e) e.preventDefault();
  const nameInput = document.getElementById('addMaintName');
  const catSelect = document.getElementById('addMaintCategory');
  const kmInput = document.getElementById('addMaintIntervalKm');
  const moInput = document.getElementById('addMaintIntervalMonths');
  const odoInput = document.getElementById('addMaintLastOdo');
  const dateInput = document.getElementById('addMaintLastDate');
  const reminderInput = document.getElementById('addMaintReminderKm');

  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    showToast('Mohon masukkan nama komponen.', 'warning');
    return;
  }

  const category = catSelect ? catSelect.value : 'general';
  const intervalKm = Number(kmInput?.value) || 10000;
  const intervalMonths = Number(moInput?.value) || 6;
  const lastServiceOdo = Number(odoInput?.value) || currentOdo;
  const lastServiceDate = dateInput?.value || new Date().toISOString().split('T')[0];
  const reminderKm = Number(reminderInput?.value) || 500;

  closeAllModals();

  const id = 'maint_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  maintenanceItems.push({
    id,
    name,
    category,
    intervalKm,
    intervalMonths,
    lastServiceOdo,
    lastServiceDate,
    reminderKm
  });

  saveMaintenanceItems();
  populateServiceModalDropdown();
  renderMaintenanceReminders();

  showToast(`Komponen "${name}" berhasil ditambahkan!`, 'success');
}

function handleEditIntervalSubmit(e) {
  if (e) e.preventDefault();
  const id = document.getElementById('editIntervalKey')?.value;
  const kmInput = document.getElementById('editIntervalKm');
  const moInput = document.getElementById('editIntervalMonths');

  const item = maintenanceItems.find(i => i.id === id);
  if (!item) return;

  item.intervalKm = Number(kmInput?.value) || 10000;
  item.intervalMonths = Number(moInput?.value) || 6;

  closeAllModals();
  saveMaintenanceItems();
  renderMaintenanceReminders();

  showToast(`Interval "${item.name}" berhasil diubah ke ${formatNumber(item.intervalKm)} KM!`, 'success');
}

function handleConfirmDelete() {
  const id = document.getElementById('deleteTargetKey')?.value;
  if (!id) return;

  const idx = maintenanceItems.findIndex(i => i.id === id);
  let name = 'Komponen';
  if (idx !== -1) {
    name = maintenanceItems[idx].name;
    maintenanceItems.splice(idx, 1);
    saveMaintenanceItems();
  }

  closeAllModals();
  populateServiceModalDropdown();
  renderMaintenanceReminders();

  showToast(`"${name}" telah berhasil dihapus.`, 'info');
}

function handleServiceFormSubmit(e) {
  if (e) e.preventDefault();
  const id = document.getElementById('serviceTypeSelect')?.value;
  const odo = document.getElementById('serviceOdoInput')?.value;
  const date = document.getElementById('serviceDateInput')?.value;
  const notes = document.getElementById('serviceNotesInput')?.value;

  if (!id) {
    showToast('Pilih komponen terlebih dahulu.', 'warning');
    return;
  }

  const item = maintenanceItems.find(i => i.id === id);
  if (item) {
    item.lastServiceOdo = Number(odo) || currentOdo;
    item.lastServiceDate = date || new Date().toISOString().split('T')[0];
    saveMaintenanceItems();
  }

  serviceHistory.unshift({
    id: 'log_' + Date.now(),
    itemId: id,
    name: item ? item.name : 'Servis Kendaraan',
    odo: Number(odo) || currentOdo,
    date: date || new Date().toISOString().split('T')[0],
    notes: notes || '',
    timestamp: new Date().toISOString()
  });
  saveServiceHistory();

  closeAllModals();
  renderMaintenanceReminders();
  showToast('Catatan servis berhasil disimpan!', 'success');
}

function handleSpeedLimitSubmit(e) {
  if (e) e.preventDefault();
  const slider = document.getElementById('speedLimitRange');
  const val = Number(slider?.value) || 60;
  currentSpeedLimit = val;

  try {
    localStorage.setItem(STORAGE_SPEED_LIMIT, val.toString());
  } catch (err) {}

  updateRedlineArc(val);
  const display = document.getElementById('valSpeedLimitDisplay');
  if (display) display.textContent = `${val} km/h`;

  closeAllModals();

  fetch(`${FIREBASE_DB_URL}/settings/speedLimit.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(val)
  }).catch(() => {});

  showToast(`Speed limit diset ke ${val} km/h`, 'success');
}

// ==========================================================================
// SPEEDOMETER GAUGE & REDLINE ARC
// ==========================================================================

function updateRedlineArc(speedLimitVal) {
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

function updateAnalogNeedle(speed, limit) {
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

// ==========================================================================
// TELEMETRY SSE STREAM & WATCHDOG
// ==========================================================================

function handleIncomingTelemetry(data) {
  if (!data) return;
  lastDataTime = Date.now();
  if (!isConnected) {
    isConnected = true;
    updateConnectionBadge(true);
  }

  const rawSpd = Number(data.rawSpeed !== undefined ? data.rawSpeed : data.speed) || 0;
  currentSpeed = rawSpd < 2.5 ? 0 : rawSpd;
  if (data.odo && Number(data.odo) > 0) currentOdo = Number(data.odo);
  if (data.trip !== undefined) currentTrip = Number(data.trip);
  if (data.status) currentStatus = data.status;

  const roundedSpeed = Math.round(currentSpeed);
  const speedValEl = document.getElementById('valSpeed');
  const speedLargeEl = document.getElementById('valSpeedLarge');
  if (speedValEl) speedValEl.textContent = roundedSpeed;
  if (speedLargeEl) speedLargeEl.textContent = roundedSpeed;

  updateAnalogNeedle(currentSpeed, currentSpeedLimit);

  const odoEl = document.getElementById('valOdo');
  if (odoEl) odoEl.textContent = formatNumber(Math.round(currentOdo));

  const tripEl = document.getElementById('valTrip');
  if (tripEl) tripEl.textContent = currentTrip < 10 ? currentTrip.toFixed(2) : currentTrip.toFixed(1);

  renderMaintenanceReminders();
}

function initTelemetry() {
  const streamUrl = `${FIREBASE_DB_URL}/vehicle/current.json`;
  
  // Initial fetch
  fetch(streamUrl)
    .then(r => r.json())
    .then(d => { if (d) handleIncomingTelemetry(d); })
    .catch(() => {});

  // Fetch Speed Limit
  fetch(`${FIREBASE_DB_URL}/settings/speedLimit.json`)
    .then(r => r.json())
    .then(lim => {
      if (lim && !isNaN(Number(lim))) {
        currentSpeedLimit = Number(lim);
        updateRedlineArc(currentSpeedLimit);
        const display = document.getElementById('valSpeedLimitDisplay');
        if (display) display.textContent = `${currentSpeedLimit} km/h`;
      }
    })
    .catch(() => {});

  // Fetch Display Mode
  fetch(`${FIREBASE_DB_URL}/settings/displayMode.json`)
    .then(r => r.json())
    .then(m => {
      if (m !== null && (m === 0 || m === 1)) {
        currentOledMode = m;
        switchOledMode(m);
      }
    })
    .catch(() => {});

  try {
    eventSource = new EventSource(streamUrl);
    eventSource.addEventListener('put', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload && payload.data) handleIncomingTelemetry(payload.data);
        else if (payload) handleIncomingTelemetry(payload);
      } catch (err) {}
    });
    eventSource.addEventListener('patch', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload && payload.data) handleIncomingTelemetry(payload.data);
        else if (payload) handleIncomingTelemetry(payload);
      } catch (err) {}
    });
    eventSource.onerror = () => {
      if (isConnected) {
        isConnected = false;
        updateConnectionBadge(false);
      }
    };
  } catch (err) {}

  // Watchdog (1 sec)
  setInterval(() => {
    if (Date.now() - lastDataTime > 3500 && isConnected) {
      isConnected = false;
      currentSpeed = 0;
      updateConnectionBadge(false);
      const speedValEl = document.getElementById('valSpeed');
      const speedLargeEl = document.getElementById('valSpeedLarge');
      if (speedValEl) speedValEl.textContent = '0';
      if (speedLargeEl) speedLargeEl.textContent = '0';
      updateAnalogNeedle(0, currentSpeedLimit);
    }
  }, 1000);
}

function updateConnectionBadge(online) {
  const dot = document.getElementById('esp32Dot');
  const label = document.getElementById('esp32StatusLabel');
  if (dot && label) {
    dot.className = online ? 'status-indicator-dot online' : 'status-indicator-dot offline';
    label.textContent = online ? 'Live Telemetry' : 'Standby';
  }
}

// ==========================================================================
// FLASH TEST CONTROLLER
// ==========================================================================
let isFlashTestActive = false;
let flashTimer = null;
let flashSec = 0;

function toggleFlashTest() {
  if (isFlashTestActive) {
    if (flashTimer) clearInterval(flashTimer);
    isFlashTestActive = false;
    flashSec = 0;

    document.getElementById('flashTestCard')?.classList.remove('is-flashing');
    const badge = document.getElementById('flashStatusBadge');
    if (badge) { badge.textContent = 'Standby'; badge.className = 'flash-status-badge'; }
    const label = document.getElementById('btnFlashLabel');
    if (label) label.textContent = 'Test Flash';

    fetch(`${FIREBASE_DB_URL}/commands/flashTest.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false, timestamp: Date.now() })
    }).catch(() => {});

    showToast('Flash Test selesai. Lampu indikator standby.', 'info');
  } else {
    isFlashTestActive = true;
    flashSec = 5;

    document.getElementById('flashTestCard')?.classList.add('is-flashing');
    const badge = document.getElementById('flashStatusBadge');
    if (badge) { badge.textContent = `⚡ Flashing ${flashSec}s`; badge.className = 'flash-status-badge active'; }
    const label = document.getElementById('btnFlashLabel');
    if (label) label.textContent = `Stop (${flashSec}s)`;

    fetch(`${FIREBASE_DB_URL}/commands/flashTest.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true, duration: 5000, timestamp: Date.now() })
    }).catch(() => {});

    showToast('⚡ Flash Test Aktif (5s): Menguji lampu oren...', 'warning');

    flashTimer = setInterval(() => {
      flashSec--;
      if (flashSec > 0) {
        if (badge) badge.textContent = `⚡ Flashing ${flashSec}s`;
        if (label) label.textContent = `Stop (${flashSec}s)`;
      } else {
        toggleFlashTest();
      }
    }, 1000);
  }
}

// ==========================================================================
// CLOCK
// ==========================================================================
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
    if (clockEl) clockEl.textContent = `${day} ${month} ${year}, ${hrs}:${mins}`;
  };
  update();
  setInterval(update, 1000);
}

// ==========================================================================
// BIND ALL FUNCTIONS TO GLOBAL WINDOW SCOPE (GUARANTEED AVAILABILITY)
// ==========================================================================
window.openAddMaintenanceModal = openAddMaintenanceModal;
window.openMaintenanceManager = openMaintenanceManager;
window.closeAllModals = closeAllModals;
window.switchOledMode = switchOledMode;
window.openEditIntervalModal = openEditIntervalModal;
window.openDeleteConfirmModal = openDeleteConfirmModal;
window.openServiceModal = openServiceModal;
window.openSpeedLimitModal = openSpeedLimitModal;
window.handleAddMaintenanceSubmit = handleAddMaintenanceSubmit;
window.handleEditIntervalSubmit = handleEditIntervalSubmit;
window.handleConfirmDelete = handleConfirmDelete;
window.handleServiceFormSubmit = handleServiceFormSubmit;
window.handleSpeedLimitSubmit = handleSpeedLimitSubmit;
window.toggleFlashTest = toggleFlashTest;

// ==========================================================================
// BOOTSTRAP IMMEDIATELY (SYNCHRONOUS & EVENT-DRIVEN)
// ==========================================================================
function initApp() {
  initClock();
  updateRedlineArc(currentSpeedLimit);
  updateAnalogNeedle(0, currentSpeedLimit);
  renderMaintenanceReminders();
  populateServiceModalDropdown();
  initTelemetry();

  // Preset chips handler
  document.getElementById('addPresetChipsList')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip-preset-item');
    if (!chip) return;
    document.querySelectorAll('.chip-preset-item').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const nameInput = document.getElementById('addMaintName');
    const catSelect = document.getElementById('addMaintCategory');
    const kmInput = document.getElementById('addMaintIntervalKm');
    const moInput = document.getElementById('addMaintIntervalMonths');

    if (nameInput && chip.dataset.name) nameInput.value = chip.dataset.name;
    if (catSelect && chip.dataset.cat) catSelect.value = chip.dataset.cat;
    if (kmInput && chip.dataset.km) {
      kmInput.value = chip.dataset.km;
      document.querySelectorAll('.btn-add-km-pre').forEach(b => b.classList.toggle('active', b.dataset.val === chip.dataset.km));
    }
    if (moInput && chip.dataset.mo) {
      moInput.value = chip.dataset.mo;
      document.querySelectorAll('.btn-add-mo-pre').forEach(b => b.classList.toggle('active', b.dataset.val === chip.dataset.mo));
    }
  });

  // Preset buttons
  document.querySelectorAll('.btn-add-km-pre').forEach(btn => {
    btn.addEventListener('click', () => {
      const kmInput = document.getElementById('addMaintIntervalKm');
      if (kmInput) kmInput.value = btn.dataset.val;
      document.querySelectorAll('.btn-add-km-pre').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  document.querySelectorAll('.btn-add-mo-pre').forEach(btn => {
    btn.addEventListener('click', () => {
      const moInput = document.getElementById('addMaintIntervalMonths');
      if (moInput) moInput.value = btn.dataset.val;
      document.querySelectorAll('.btn-add-mo-pre').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // Forms
  document.getElementById('formAddMaintenance')?.addEventListener('submit', handleAddMaintenanceSubmit);
  document.getElementById('formEditInterval')?.addEventListener('submit', handleEditIntervalSubmit);
  document.getElementById('formAddService')?.addEventListener('submit', handleServiceFormSubmit);
  document.getElementById('formSpeedLimit')?.addEventListener('submit', handleSpeedLimitSubmit);
  document.getElementById('btnConfirmDeleteAction')?.addEventListener('click', handleConfirmDelete);
  document.getElementById('btnFlashTest')?.addEventListener('click', toggleFlashTest);

  // Speed Limit Slider
  const slider = document.getElementById('speedLimitRange');
  const sliderVal = document.getElementById('speedLimitSliderVal');
  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      if (sliderVal) sliderVal.textContent = val;
      document.querySelectorAll('.btn-pre').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.val) === val));
    });
  }

  document.querySelectorAll('.btn-pre').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = Number(btn.dataset.val);
      if (slider) slider.value = val;
      if (sliderVal) sliderVal.textContent = val;
      document.querySelectorAll('.btn-pre').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // Bottom Tabs
  document.querySelectorAll('.nav-tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab-item').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      if (tabName === 'trip') {
        fetch(`${FIREBASE_DB_URL}/vehicle/current/trip.json`, { method: 'PUT', body: JSON.stringify(0.0) }).catch(() => {});
        fetch(`${FIREBASE_DB_URL}/commands/resetTrip.json`, { method: 'PUT', body: JSON.stringify({ active: true, timestamp: Date.now() }) }).catch(() => {});
        currentTrip = 0;
        const tripEl = document.getElementById('valTrip');
        if (tripEl) tripEl.textContent = '0.0';
        showToast('Trip meter berhasil direset ke 0.0 km', 'success');
        setTimeout(() => {
          document.getElementById('tabNavDashboard')?.classList.add('active');
          tab.classList.remove('active');
        }, 1200);
      } else if (tabName === 'maintenance') {
        openMaintenanceManager();
      } else if (tabName === 'settings') {
        openSpeedLimitModal();
      }
    });
  });

  // Global Backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) closeAllModals(); });
  });
}

// Run immediately!
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
