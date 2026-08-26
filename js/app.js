/**
 * VEHICLE MONITOR - APP CONTROLLER (ULTRA SMOOTH 60FPS)
 * 
 * High-performance, lightweight orchestrator for the Vehicle Monitor Dashboard.
 */

import { 
  initFirebaseRealtime,
  subscribeVehicleData, 
  subscribeSpeedLimit, 
  subscribeMaintenanceStatus, 
  subscribeServiceHistory, 
  subscribeConnectionStatus,
  subscribeFlashTest,
  writeSpeedLimit, 
  writeResetTrip,
  writeFlashTest
} from './telemetry-service.js';
import { maintenanceEngine } from './maintenance-engine.js';

let currentSpeed = 0;
let currentSpeedLimit = 60;
let currentOdo = 97248;
let currentTrip = 0;
let currentStatus = "Normal";

document.addEventListener('DOMContentLoaded', () => {
  // 1. Instant Synchronous UI Bootstrapping (Zero Lag)
  initClock();
  setupUIEvents();
  setupFlashTestController();
  setupSpeedLimiterModal();
  setupEditIntervalModal();
  setupConnectionModal();
  populateServiceModalDropdown();
  maintenanceEngine.setCurrentOdo(currentOdo);
  renderMaintenanceReminders();

  // 2. Start Realtime Hardware Telemetry (No Dummy Data)
  initFirebaseRealtime();

  // 3. Telemetry Subscriptions
  subscribeVehicleData((data) => {
    handleVehicleDataUpdate(data);
  });

  subscribeSpeedLimit((limit) => {
    if (limit !== null && limit !== undefined) {
      currentSpeedLimit = Number(limit);
      updateSpeedLimitDisplay(currentSpeedLimit);
    }
  });

  subscribeMaintenanceStatus(() => {
    renderMaintenanceReminders();
  });

  subscribeServiceHistory(() => {
    renderMaintenanceReminders();
  });

  // 4. Connection / Status Listener
  subscribeConnectionStatus((status) => {
    updateConnectionBadge(status.connected);
  });
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
   SUPER SMOOTH TELEMETRY UPDATES
   ========================================================================== */
let lastDisplayedSpeed = -1;
let lastDisplayedOdo = -1;
let lastDisplayedTrip = -1;

function handleVehicleDataUpdate(data) {
  if (!data) return;

  const rawSpd = Number(data.rawSpeed !== undefined ? data.rawSpeed : data.speed) || 0;
  // Clean stationary deadband filter (anything under 2.5 km/h is treated strictly as 0)
  currentSpeed = rawSpd < 2.5 ? 0 : rawSpd;
  currentOdo = (Number(data.odo) > 0) ? Number(data.odo) : currentOdo;
  currentTrip = Number(data.trip) || currentTrip;
  currentStatus = data.status || currentStatus;

  // Cached DOM writes for peak performance
  const roundedSpeed = Math.round(currentSpeed);
  if (roundedSpeed !== lastDisplayedSpeed) {
    lastDisplayedSpeed = roundedSpeed;
    const speedValEl = document.getElementById('valSpeed');
    const speedLargeEl = document.getElementById('valSpeedLarge');
    if (speedValEl) speedValEl.textContent = roundedSpeed;
    if (speedLargeEl) speedLargeEl.textContent = roundedSpeed;

    // Speed Gauge Arc calculation (Scale: 0 to 80 km/h)
    const maxScale = 80;
    const clampedSpeed = Math.min(maxScale, Math.max(0, currentSpeed));
    const arcLength = 236; // Radius 75 semi-arc length
    const offset = arcLength - (clampedSpeed / maxScale) * arcLength;

    const gaugeFill = document.getElementById('speedGaugeFill');
    if (gaugeFill) {
      gaugeFill.style.strokeDashoffset = offset;
      if (currentSpeed > currentSpeedLimit) {
        gaugeFill.style.stroke = '#ef4444';
        if (speedValEl) speedValEl.style.color = '#ef4444';
      } else {
        gaugeFill.style.stroke = '#38bdf8';
        if (speedValEl) speedValEl.style.color = '#ffffff';
      }
    }

    // Over-speed alert notification
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

  const roundedOdo = Math.round(currentOdo);
  if (roundedOdo !== lastDisplayedOdo && roundedOdo > 0) {
    lastDisplayedOdo = roundedOdo;
    const odoEl = document.getElementById('valOdo');
    if (odoEl) odoEl.textContent = maintenanceEngine.formatNumber(roundedOdo);
    maintenanceEngine.setCurrentOdo(roundedOdo);
  }

  const tripNum = Number(currentTrip) || 0;
  const formattedTrip = tripNum < 10 ? tripNum.toFixed(2) : tripNum.toFixed(1);
  if (formattedTrip !== lastDisplayedTrip) {
    lastDisplayedTrip = formattedTrip;
    const tripEl = document.getElementById('valTrip');
    if (tripEl) tripEl.textContent = formattedTrip;
  }
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

  // 1. Status badge in header / 2x2 grid
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

  // 2. Dynamic Update of Dashboard Main Cards (Engine Oil, Transmission, Coolant)
  const previewKeys = ['oil_engine', 'transmission_oil', 'coolant'];
  previewKeys.forEach(key => {
    const item = allCards.find(c => c.key === key);
    if (!item) return;

    const nameEl = document.getElementById(`name-${key}`);
    const intEl = document.getElementById(`interval-${key}`);
    const remEl = document.getElementById(`rem-${key}`);
    const barEl = document.getElementById(`bar-${key}`);
    const pctEl = document.getElementById(`pct-${key}`);
    const tagEl = document.getElementById(`tag-${key}`);

    const pct = Math.max(0, Math.min(100, Math.round(Number(item.percentUsed !== undefined ? item.percentUsed : item.progressPercent) || 0)));

    if (nameEl) nameEl.textContent = item.name;
    if (intEl) intEl.textContent = `Setiap ${maintenanceEngine.formatNumber(item.intervalKm)} km`;
    if (remEl) {
      remEl.textContent = item.kmLeft > 0 ? `${maintenanceEngine.formatNumber(item.kmLeft)} km lagi` : 'Jatuh tempo';
    }
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (tagEl) {
      tagEl.textContent = item.status === 'DUE' ? 'Due Service' : (item.status === 'WARNING' ? 'Warning' : 'Normal');
      tagEl.className = `m-status-tag ${item.status.toLowerCase()}`;
    }
    if (barEl) {
      barEl.style.width = `${pct}%`;
      if (item.status === 'DUE') {
        barEl.style.background = '#ef4444';
      } else if (item.status === 'WARNING') {
        barEl.style.background = '#f59e0b';
      } else {
        barEl.style.background = '#10b981';
      }
    }
  });

  // 3. Populate list in Full Maintenance Manager Modal
  const fullContainer = document.getElementById('fullMaintenanceListContainer');
  if (fullContainer) {
    fullContainer.innerHTML = allCards.map(item => `
      <div class="modal-service-card" data-key="${item.key}" style="background: #1e293b; border: 1px solid rgba(255,255,255,0.12); padding: 1rem; border-radius: 14px; display: flex; flex-direction: column; gap: 0.75rem; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: #ffffff;">${item.name}</div>
            <div style="font-size: 0.76rem; color: #94a3b8; margin-top: 3px;">Interval: <strong style="color: #38bdf8;">${maintenanceEngine.formatNumber(item.intervalKm)} KM</strong> / <strong style="color: #38bdf8;">${item.intervalMonths} Bulan</strong></div>
            <div style="font-size: 0.76rem; color: #94a3b8; margin-top: 1px;">Berikutnya: ${maintenanceEngine.formatNumber(item.nextServiceOdo)} KM (${item.nextServiceDate || '-'})</div>
          </div>
          <div style="text-align: right;">
            <span style="font-weight: 700; font-size: 0.75rem; padding: 0.2rem 0.55rem; border-radius: 6px; background: ${item.status === 'DUE' ? 'rgba(239,68,68,0.18)' : (item.status === 'WARNING' ? 'rgba(245,158,11,0.18)' : 'rgba(16,185,129,0.18)')}; color: ${item.status === 'DUE' ? '#ef4444' : (item.status === 'WARNING' ? '#f59e0b' : '#10b981')};">${item.status}</span>
            <div style="font-size: 0.76rem; font-weight: 600; color: #cbd5e1; margin-top: 4px;">${item.kmLeft > 0 ? `${maintenanceEngine.formatNumber(item.kmLeft)} KM lagi` : 'Jatuh tempo'}</div>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; padding-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.06);">
          <button type="button" class="btn-sec btn-edit-interval-item" data-key="${item.key}" style="padding: 0.35rem 0.75rem; font-size: 0.76rem; border-radius: 8px;">⚙️ Ubah Interval</button>
          <button type="button" class="btn-pri btn-log-service-item" data-key="${item.key}" style="padding: 0.35rem 0.85rem; font-size: 0.76rem; border-radius: 8px;">+ Catat Servis</button>
        </div>
      </div>
    `).join('');

    // Attach click triggers
    fullContainer.querySelectorAll('.btn-edit-interval-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllModals();
        openEditIntervalModal(btn.dataset.key);
      });
    });

    fullContainer.querySelectorAll('.btn-log-service-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllModals();
        openServiceModal(btn.dataset.key);
      });
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
    form.addEventListener('submit', async (e) => {
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
   UI EVENTS & BOTTOM TAB BAR (SUPER FLUID)
   ========================================================================== */
function setupUIEvents() {
  // Bottom Tab Navigation
  const tabs = document.querySelectorAll('.nav-tab-item');
  tabs.forEach(tab => {
    tab.addEventListener('click', async () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabName = tab.dataset.tab;
      if (tabName === 'trip') {
        await writeResetTrip();
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

  closeAllModals();
  await maintenanceEngine.logService({ type, odo: Number(odo), date, notes, items });
  renderMaintenanceReminders();
  showToast('Catatan servis berhasil disimpan!', 'success');
}

/* ==========================================================================
   EDIT INTERVAL CONTROLLER (SUPER FAST & SMOOTH)
   ========================================================================== */
function openEditIntervalModal(key) {
  const modal = document.getElementById('modalEditInterval');
  if (!modal) return;

  const setting = maintenanceEngine.settings[key];
  if (!setting) return;

  const titleEl = document.getElementById('editIntervalTitle');
  const keyInput = document.getElementById('editIntervalKey');
  const kmInput = document.getElementById('editIntervalKm');
  const moInput = document.getElementById('editIntervalMonths');

  if (titleEl) titleEl.textContent = `Ubah Interval: ${setting.name}`;
  if (keyInput) keyInput.value = key;
  if (kmInput) kmInput.value = setting.intervalKm;
  if (moInput) moInput.value = setting.intervalMonths;

  // Highlight active preset buttons
  document.querySelectorAll('.btn-preset-km').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.val) === Number(setting.intervalKm));
  });
  document.querySelectorAll('.btn-preset-mo').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.val) === Number(setting.intervalMonths));
  });

  modal.classList.add('open');
}

function setupEditIntervalModal() {
  const form = document.getElementById('formEditInterval');
  const kmInput = document.getElementById('editIntervalKm');
  const moInput = document.getElementById('editIntervalMonths');

  // Preset KM buttons
  document.querySelectorAll('.btn-preset-km').forEach(btn => {
    btn.addEventListener('click', () => {
      if (kmInput) kmInput.value = btn.dataset.val;
      document.querySelectorAll('.btn-preset-km').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // Preset Month buttons
  document.querySelectorAll('.btn-preset-mo').forEach(btn => {
    btn.addEventListener('click', () => {
      if (moInput) moInput.value = btn.dataset.val;
      document.querySelectorAll('.btn-preset-mo').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const key = document.getElementById('editIntervalKey').value;
      const intervalKm = Number(kmInput.value) || 20000;
      const intervalMonths = Number(moInput.value) || 6;

      const itemName = maintenanceEngine.settings[key] ? maintenanceEngine.settings[key].name : 'Item';

      // 1. Instantly close modal (0ms UI latency)
      closeAllModals();

      // 2. Synchronous in-memory & local state update
      await maintenanceEngine.updateSetting(key, { intervalKm, intervalMonths });

      // 3. Instantly re-render dashboard (60fps)
      renderMaintenanceReminders();

      // 4. Show success toast
      showToast(`Interval ${itemName} diubah ke ${maintenanceEngine.formatNumber(intervalKm)} KM / ${intervalMonths} Bulan!`, 'success');
    });
  }
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
   FLASH TEST CONTROLLER (LAMPU OREN / PIN 4 WARNING INDICATOR)
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
  } catch (e) {
    // Silent fallback
  }
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

  // Remote flash test sync listener
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

/* ==========================================================================
   SERVICE WORKER REGISTRATION (NATIVE PWA SUPPORT)
   ========================================================================== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('[PWA] Service Worker Active'))
      .catch(err => console.warn('[PWA] Service Worker registration failed:', err));
  });
}




