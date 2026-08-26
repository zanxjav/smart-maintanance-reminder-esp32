/**
 * VEHICLE TELEMETRY & STATE BUS SERVICE
 * 
 * Clean, lightweight, zero-dependency event broker and local persistence
 * for the Vehicle Monitor Dashboard. Fully compatible with GitHub Pages & static hosting.
 */

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

/**
 * Dispatch an update to all registered subscribers of a channel.
 * @param {string} channel - Channel name (e.g. 'vehicle', 'speedLimit', 'settings', etc.)
 * @param {any} data - Payload data
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
 * Subscriptions
 */
export function subscribeVehicleData(callback) {
  listeners.vehicle.push(callback);
}

export function subscribeSpeedLimit(callback) {
  listeners.speedLimit.push(callback);
  // Send initial value if stored
  try {
    const saved = localStorage.getItem(STORAGE_SPEED_LIMIT);
    if (saved !== null) {
      callback(Number(saved));
    }
  } catch (e) {
    // Ignore localStorage errors in private browsing
  }
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
  callback({ connected: true, mode: 'STANDALONE', status: 'Active' });
}

/**
 * Save Speed Limit to Local Storage & Broadcast
 */
export async function writeSpeedLimit(speedLimitVal) {
  const val = Number(speedLimitVal);
  try {
    localStorage.setItem(STORAGE_SPEED_LIMIT, val.toString());
  } catch (e) {
    // Ignore quota/private mode errors
  }
  dispatchLocalUpdate('speedLimit', val);
  return { success: true, speedLimit: val };
}

/**
 * Reset Trip Meter
 */
export async function writeResetTrip() {
  dispatchLocalUpdate('vehicle', { trip: 0.0 });
  return { success: true, trip: 0.0 };
}

/**
 * Save Service History Record & Broadcast
 */
export async function writeServiceRecord(record, updatedMaintenanceMap) {
  try {
    const history = getStoredServiceHistory();
    history.unshift({
      id: Date.now().toString(),
      ...record,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_SERVICE_HISTORY, JSON.stringify(history));
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
  } catch (e) {
    console.warn("Could not persist maintenance settings:", e);
  }
  dispatchLocalUpdate('settings', settingsMap);
  return { success: true };
}

/**
 * Helper to get stored service history
 */
export function getStoredServiceHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_SERVICE_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Helper to get stored maintenance settings
 */
export function getStoredMaintenanceSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_MAINTENANCE_SETTINGS);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
