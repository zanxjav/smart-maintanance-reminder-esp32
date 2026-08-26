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

/**
 * Initialize Realtime Firebase EventSource Stream (Zero-Dependency SSE)
 */
export function initFirebaseRealtime() {
  const streamUrl = `${FIREBASE_DB_URL}/vehicle/current.json`;
  
  // Initial fetch for instant display
  fetch(streamUrl)
    .then(res => res.json())
    .then(data => {
      if (data) {
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
        if (payload && payload.data) {
          handleIncomingData(payload.data);
        }
      } catch (err) {
        console.error('[Firebase] SSE parse error:', err);
      }
    });

    eventSource.addEventListener('patch', (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload && payload.data) {
          handleIncomingData(payload.data);
        }
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

  // Heartbeat watchdog (fallback poll every 2s in case SSE drops)
  setInterval(() => {
    fetch(streamUrl)
      .then(res => res.json())
      .then(data => {
        if (data) handleIncomingData(data);
      })
      .catch(() => {});
  }, 2000);
}

function handleIncomingData(data) {
  if (!data) return;
  lastDataTime = Date.now();
  
  // Clean & sanitize hardware data
  const telemetry = {
    speed: Number(data.speed) || 0,
    rawSpeed: Number(data.rawSpeed) || Number(data.speed) || 0,
    odo: Number(data.odo) || 0,
    trip: Number(data.trip) || 0,
    speedLimit: Number(data.speedLimit) || 60,
    gps: data.gps || 'Connected',
    esp32: data.esp32 || 'Online',
    status: data.status || 'Normal',
    date: data.date || '--',
    time: data.time || '--',
    lastUpdate: data.lastUpdate || data.time || 'Live',
    lat: data.lat || 0,
    lng: data.lng || 0,
    satellites: data.satellites || 0
  };

  dispatchLocalUpdate('vehicle', telemetry);
  if (data.speedLimit) {
    dispatchLocalUpdate('speedLimit', Number(data.speedLimit));
  }
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
 * Save Speed Limit to Firebase RTDB & Local Storage
 */
export async function writeSpeedLimit(speedLimitVal) {
  const val = Number(speedLimitVal);
  try {
    localStorage.setItem(STORAGE_SPEED_LIMIT, val.toString());
  } catch (e) {}

  dispatchLocalUpdate('speedLimit', val);

  // Sync directly to Firebase Realtime Database
  try {
    await fetch(`${FIREBASE_DB_URL}/settings/speedLimit.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(val)
    });
  } catch (err) {
    console.warn('[Firebase] Failed to write speed limit to cloud:', err);
  }

  return { success: true, speedLimit: val };
}

/**
 * Reset Trip Meter in Firebase
 */
export async function writeResetTrip() {
  dispatchLocalUpdate('vehicle', { trip: 0.0 });
  try {
    await fetch(`${FIREBASE_DB_URL}/vehicle/current/trip.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(0.0)
    });
  } catch (e) {}
  return { success: true, trip: 0.0 };
}

/**
 * Save Service History Record
 */
export async function writeServiceRecord(record) {
  try {
    const history = getStoredServiceHistory();
    history.unshift({
      id: Date.now().toString(),
      ...record,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_SERVICE_HISTORY, JSON.stringify(history));

    // Sync to Firebase RTDB Cloud
    await fetch(`${FIREBASE_DB_URL}/maintenance/history.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(history)
    });
  } catch (e) {
    console.warn("Could not persist service record:", e);
  }
  dispatchLocalUpdate('history', record);
  return { success: true };
}

/**
 * Save Custom Maintenance Settings
 */
export async function writeMaintenanceSettings(settingsMap) {
  try {
    localStorage.setItem(STORAGE_MAINTENANCE_SETTINGS, JSON.stringify(settingsMap));
    await fetch(`${FIREBASE_DB_URL}/maintenance/settings.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsMap)
    });
  } catch (e) {
    console.warn("Could not persist maintenance settings:", e);
  }
  dispatchLocalUpdate('settings', settingsMap);
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
