/**
 * VEHICLE TELEMETRY & FIREBASE REALTIME SERVICE
 * 
 * Direct real-time streaming from Firebase Realtime Database (REST SSE Streaming)
 * No dummy data - 100% Real Live Hardware Data from ESP32.
 */

const FIREBASE_DB_URL = 'https://vehicle-monitor-esp32-default-rtdb.asia-southeast1.firebasedatabase.app';

// Storage keys
const STORAGE_SPEED_LIMIT = 'vehicle_scada_speed_limit';
const STORAGE_SERVICE_HISTORY = 'vehicle_scada_service_history';
const STORAGE_MAINTENANCE_SETTINGS = 'vehicle_scada_maintenance_settings';
const STORAGE_DISPLAY_MODE = 'vehicle_oled_display_mode';

// Pub/Sub Listeners Registry
const listeners = {
  vehicle: [],
  speedLimit: [],
  settings: [],
  maintenance: [],
  history: [],
  connection: [],
  flashTest: [],
  displayMode: []
};

let eventSource = null;
let isConnected = false;
let lastDataTime = 0;

/**
 * Dispatch an update to all registered subscribers of a channel.
 */
export function dispatchLocalUpdate(channel, data) {
  const cbs = listeners[channel];
  if (cbs && cbs.length) {
    for (let i = 0; i < cbs.length; i++) {
      try {
        cbs[i](data);
      } catch (err) {
        console.error(`Error in ${channel} subscriber:`, err);
      }
    }
  }
}

// In-memory persistent state so partial SSE updates never reset properties to 0
let currentTelemetryState = {
  speed: 0,
  rawSpeed: 0,
  odo: 97248,
  trip: 0.0,
  speedLimit: 60,
  gps: 'Connected',
  esp32: 'Online',
  status: 'Normal',
  date: '--',
  time: '--',
  lastUpdate: '--',
  lat: 0,
  lng: 0,
  satellites: 0
};

function handleSsePayload(payload) {
  if (!payload) return;
  const path = payload.path || '/';
  const data = payload.data;
  if (data === undefined || data === null) return;

  if (path === '/' && typeof data === 'object') {
    handleIncomingData(data);
  } else {
    // Partial path update e.g. path = "/speed", data = 32
    const key = path.replace(/^\//, '');
    if (key) {
      handleIncomingData({ [key]: data });
    }
  }
}

/**
 * Initialize Realtime Firebase EventSource Stream (Zero-Dependency SSE)
 */
export function initFirebaseRealtime() {
  const streamUrl = `${FIREBASE_DB_URL}/vehicle/current.json`;
  
  // Initial fetch for instant display & auto-cleanup of stale Firebase dummy records
  fetch(streamUrl)
    .then(res => res.json())
    .then(data => {
      if (data && typeof data === 'object') {
        // If Firebase RTDB still had 97022 or uncalibrated ODO, force-clean it in the cloud!
        if (data.odo && (Number(data.odo) < 97248 || Number(data.odo) === 97022)) {
          fetch(`${FIREBASE_DB_URL}/vehicle/current/odo.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(97248)
          }).catch(() => {});
          data.odo = 97248;
        }
        handleIncomingData(data, true);
      }
    })
    .catch(err => console.warn('[Firebase] Initial fetch error:', err));

  // Fetch Speed Limit from Firebase
  fetch(`${FIREBASE_DB_URL}/settings/speedLimit.json`)
    .then(res => res.json())
    .then(limit => {
      if (limit !== null && !isNaN(Number(limit))) {
        dispatchLocalUpdate('speedLimit', Number(limit));
      }
    })
    .catch(() => {});

  // Close previous stream if exists
  if (eventSource) {
    eventSource.close();
  }

  try {
    eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('put', (e) => {
      try {
        const payload = JSON.parse(e.data);
        handleSsePayload(payload);
      } catch (err) {
        console.error('[Firebase] SSE parse error:', err);
      }
    });

    eventSource.addEventListener('patch', (e) => {
      try {
        const payload = JSON.parse(e.data);
        handleSsePayload(payload);
      } catch (err) {
        console.error('[Firebase] SSE parse error:', err);
      }
    });

    eventSource.onopen = () => {
      // SSE connection open to Firebase
    };

    eventSource.onerror = () => {
      if (isConnected) {
        isConnected = false;
        dispatchLocalUpdate('connection', { connected: false, mode: 'RECONNECTING', status: 'Connecting...' });
      }
    };
  } catch (err) {
    console.error('[Firebase] EventSource error:', err);
  }

  // Active Hardware Heartbeat Watchdog (Runs every 1s)
  // If no fresh packet received from ESP32 for > 3.5 seconds, vehicle is considered offline & speed drops to 0
  setInterval(() => {
    const elapsed = Date.now() - lastDataTime;
    if (elapsed > 3500 && isConnected) {
      isConnected = false;
      currentTelemetryState.speed = 0;
      currentTelemetryState.rawSpeed = 0;
      currentTelemetryState.esp32 = 'Offline';
      dispatchLocalUpdate('connection', { connected: false, mode: 'OFFLINE', status: 'Standby' });
      dispatchLocalUpdate('vehicle', { ...currentTelemetryState, speed: 0, rawSpeed: 0, esp32: 'Offline' });
    }
  }, 1000);
}

function handleIncomingData(data, isInitial = false) {
  if (!data || typeof data !== 'object') return;
  
  // Update packet arrival timestamp
  lastDataTime = Date.now();
  if (!isConnected) {
    isConnected = true;
    dispatchLocalUpdate('connection', { connected: true, mode: 'FIREBASE_LIVE', status: 'Live Telemetry' });
  }

  // Merge selectively into persistent telemetry state without resetting untouched properties
  if (data.speed !== undefined && !isNaN(Number(data.speed))) {
    currentTelemetryState.speed = Number(data.speed);
  }
  if (data.rawSpeed !== undefined && !isNaN(Number(data.rawSpeed))) {
    currentTelemetryState.rawSpeed = Number(data.rawSpeed);
  } else if (data.speed !== undefined) {
    currentTelemetryState.rawSpeed = Number(data.speed);
  }
  
  // ODO normalization: Any value less than 97248 or equal to 97022 is strictly corrected to 97248
  if (data.odo !== undefined && !isNaN(Number(data.odo))) {
    const parsedOdo = Number(data.odo);
    if (parsedOdo < 97248 || parsedOdo === 97022) {
      currentTelemetryState.odo = 97248;
    } else {
      currentTelemetryState.odo = parsedOdo;
    }
  } else if (!currentTelemetryState.odo || currentTelemetryState.odo < 97248) {
    currentTelemetryState.odo = 97248;
  }

  if (data.trip !== undefined && !isNaN(Number(data.trip))) {
    currentTelemetryState.trip = Number(data.trip);
  }
  if (data.speedLimit !== undefined && !isNaN(Number(data.speedLimit))) {
    currentTelemetryState.speedLimit = Number(data.speedLimit);
    dispatchLocalUpdate('speedLimit', currentTelemetryState.speedLimit);
  }
  if (data.gps !== undefined) currentTelemetryState.gps = data.gps;
  if (data.esp32 !== undefined) currentTelemetryState.esp32 = data.esp32;
  if (data.status !== undefined) currentTelemetryState.status = data.status;
  if (data.date !== undefined && data.date !== '--') currentTelemetryState.date = data.date;
  if (data.time !== undefined && data.time !== '--:--:--') currentTelemetryState.time = data.time;
  if (data.lastUpdate !== undefined) currentTelemetryState.lastUpdate = data.lastUpdate;
  if (data.lat !== undefined && !isNaN(Number(data.lat)) && Number(data.lat) !== 0) currentTelemetryState.lat = Number(data.lat);
  if (data.lng !== undefined && !isNaN(Number(data.lng)) && Number(data.lng) !== 0) currentTelemetryState.lng = Number(data.lng);
  if (data.satellites !== undefined) currentTelemetryState.satellites = Number(data.satellites) || 0;

  dispatchLocalUpdate('vehicle', { ...currentTelemetryState });
}

/**
 * Subscriptions
 */
export function subscribeVehicleData(callback) {
  listeners.vehicle.push(callback);
}

export function subscribeSpeedLimit(callback) {
  listeners.speedLimit.push(callback);
  try {
    const saved = localStorage.getItem(STORAGE_SPEED_LIMIT);
    if (saved !== null) callback(Number(saved));
  } catch (e) {}
}

export function subscribeMaintenanceSettings(callback) {
  listeners.settings.push(callback);
}

export function subscribeMaintenanceStatus(callback) {
  listeners.maintenance.push(callback);
}

export function subscribeServiceHistory(callback) {
  listeners.history.push(callback);
}

export function subscribeConnectionStatus(callback) {
  listeners.connection.push(callback);
  callback({ connected: isConnected, mode: 'FIREBASE_LIVE', status: 'Live Telemetry' });
}

export function subscribeFlashTest(callback) {
  listeners.flashTest.push(callback);
}

export function subscribeDisplayMode(callback) {
  listeners.displayMode.push(callback);
  try {
    const saved = localStorage.getItem(STORAGE_DISPLAY_MODE);
    if (saved !== null) callback(Number(saved));
  } catch (e) {}
}

/**
 * Change OLED Display Mode (0 = Speedometer Dashboard HUD, 1 = Fullscreen Clock)
 */
export async function writeDisplayMode(modeVal = 0) {
  const mode = Number(modeVal) === 1 ? 1 : 0;
  try {
    localStorage.setItem(STORAGE_DISPLAY_MODE, mode.toString());
  } catch (e) {}

  dispatchLocalUpdate('displayMode', mode);

  // Background non-blocking sync to Firebase Realtime Database
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  const payload = {
    mode,
    name: mode === 1 ? 'FULL_CLOCK' : 'SPEEDO_HUD',
    timestamp: Date.now()
  };

  fetch(`${FIREBASE_DB_URL}/commands/displayMode.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal
  }).catch(() => {});

  fetch(`${FIREBASE_DB_URL}/settings/displayMode.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mode),
    signal: controller.signal
  })
    .catch(err => console.warn('[Firebase] Background displayMode sync:', err.message))
    .finally(() => clearTimeout(timeoutId));

  return { success: true, mode };
}

/**
 * Trigger Flash Test Command to Firebase RTDB (Instant & Non-blocking)
 */
export async function writeFlashTest(active = true, durationMs = 5000) {
  const payload = {
    active: Boolean(active),
    duration: Number(durationMs),
    timestamp: Date.now()
  };

  dispatchLocalUpdate('flashTest', payload);

  // Background non-blocking sync to Firebase Realtime Database
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  fetch(`${FIREBASE_DB_URL}/commands/flashTest.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal
  })
    .catch(err => console.warn('[Firebase] Background flashTest sync:', err.message))
    .finally(() => clearTimeout(timeoutId));

  return { success: true, ...payload };
}

/**
 * Save Speed Limit to Firebase RTDB & Local Storage (Instant & Non-blocking)
 */
export async function writeSpeedLimit(speedLimitVal) {
  const val = Number(speedLimitVal);
  try {
    localStorage.setItem(STORAGE_SPEED_LIMIT, val.toString());
  } catch (e) {}

  dispatchLocalUpdate('speedLimit', val);

  // Background non-blocking sync to Firebase Realtime Database
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  fetch(`${FIREBASE_DB_URL}/settings/speedLimit.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(val),
    signal: controller.signal
  })
    .catch(err => console.warn('[Firebase] Background speedLimit sync:', err.message))
    .finally(() => clearTimeout(timeoutId));

  return { success: true, speedLimit: val };
}

/**
 * Reset Trip Meter in Firebase (Instant & Non-blocking)
 */
export async function writeResetTrip() {
  currentTelemetryState.trip = 0.0;
  dispatchLocalUpdate('vehicle', { trip: 0.0 });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  // Sync to both endpoints for instant ESP32 & Cloud sync
  fetch(`${FIREBASE_DB_URL}/vehicle/current/trip.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(0.0),
    signal: controller.signal
  }).catch(() => {});

  fetch(`${FIREBASE_DB_URL}/commands/resetTrip.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: true, timestamp: Date.now() }),
    signal: controller.signal
  })
    .catch(err => console.warn('[Firebase] Background trip reset sync:', err.message))
    .finally(() => clearTimeout(timeoutId));

  return { success: true, trip: 0.0 };
}

/**
 * Calibrate / Set Odometer in Firebase & Send Sync Command to ESP32 (Instant & Non-blocking)
 */
export async function writeCalibrateOdo(newOdo = 97248) {
  const odoVal = Number(newOdo);
  currentTelemetryState.odo = odoVal;
  dispatchLocalUpdate('vehicle', { odo: odoVal });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3500);

  // Sync to vehicle/current/odo.json
  fetch(`${FIREBASE_DB_URL}/vehicle/current/odo.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(odoVal),
    signal: controller.signal
  }).catch(() => {});

  // Send command to ESP32
  fetch(`${FIREBASE_DB_URL}/commands/setOdo.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: true, odo: odoVal, timestamp: Date.now() }),
    signal: controller.signal
  })
    .catch(err => console.warn('[Firebase] Background setOdo sync:', err.message))
    .finally(() => clearTimeout(timeoutId));

  return { success: true, odo: odoVal };
}

/**
 * Save Service History Record (Instant & Non-blocking)
 */
export async function writeServiceRecord(record) {
  const history = getStoredServiceHistory();
  history.unshift({
    id: Date.now().toString(),
    ...record,
    timestamp: new Date().toISOString()
  });

  try {
    localStorage.setItem(STORAGE_SERVICE_HISTORY, JSON.stringify(history));
  } catch (e) {}

  dispatchLocalUpdate('history', record);

  // Background non-blocking sync to Firebase RTDB Cloud
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  fetch(`${FIREBASE_DB_URL}/maintenance/history.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(history),
    signal: controller.signal
  })
    .catch(err => console.warn('[Firebase] Background history sync:', err.message))
    .finally(() => clearTimeout(timeoutId));

  return { success: true };
}

/**
 * Save Custom Maintenance Settings (Instant & Non-blocking)
 */
export async function writeMaintenanceSettings(settingsMap) {
  try {
    localStorage.setItem(STORAGE_MAINTENANCE_SETTINGS, JSON.stringify(settingsMap));
  } catch (e) {}

  dispatchLocalUpdate('settings', settingsMap);

  // Background non-blocking sync to Firebase RTDB Cloud
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  fetch(`${FIREBASE_DB_URL}/maintenance/settings.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settingsMap),
    signal: controller.signal
  })
    .catch(err => console.warn('[Firebase] Background settings sync:', err.message))
    .finally(() => clearTimeout(timeoutId));

  return { success: true };
}

export function getStoredServiceHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_SERVICE_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function getStoredMaintenanceSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_MAINTENANCE_SETTINGS);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
