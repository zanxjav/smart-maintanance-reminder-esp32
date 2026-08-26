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

// Pub/Sub Listeners Registry
const listeners = {
  vehicle: [],
  speedLimit: [],
  settings: [],
  maintenance: [],
  history: [],
  connection: []
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
  odo: 0,
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
  
  // Initial fetch for instant display
  fetch(streamUrl)
    .then(res => res.json())
    .then(data => {
      if (data && typeof data === 'object') {
        handleIncomingData(data);
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
      isConnected = true;
      dispatchLocalUpdate('connection', { connected: true, mode: 'FIREBASE_LIVE', status: 'Live Telemetry' });
    };

    eventSource.onerror = () => {
      isConnected = false;
      dispatchLocalUpdate('connection', { connected: false, mode: 'RECONNECTING', status: 'Connecting...' });
    };
  } catch (err) {
    console.error('[Firebase] EventSource error:', err);
  }

  // Heartbeat watchdog (fallback poll every 3s in case SSE drops)
  setInterval(() => {
    fetch(streamUrl)
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') handleIncomingData(data);
      })
      .catch(() => {});
  }, 3000);
}

function handleIncomingData(data) {
  if (!data || typeof data !== 'object') return;
  lastDataTime = Date.now();

  // Merge selectively into persistent telemetry state without resetting untouched properties
  if (data.speed !== undefined && !isNaN(Number(data.speed))) {
    currentTelemetryState.speed = Number(data.speed);
  }
  if (data.rawSpeed !== undefined && !isNaN(Number(data.rawSpeed))) {
    currentTelemetryState.rawSpeed = Number(data.rawSpeed);
  } else if (data.speed !== undefined) {
    currentTelemetryState.rawSpeed = Number(data.speed);
  }
  if (data.odo !== undefined && !isNaN(Number(data.odo)) && Number(data.odo) > 0) {
    currentTelemetryState.odo = Number(data.odo);
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

  fetch(`${FIREBASE_DB_URL}/vehicle/current/trip.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(0.0),
    signal: controller.signal
  })
    .catch(err => console.warn('[Firebase] Background trip reset sync:', err.message))
    .finally(() => clearTimeout(timeoutId));

  return { success: true, trip: 0.0 };
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
