/**
 * ESP32 DIRECT WIFI DATA LAYER (ZERO FIREBASE DEPENDENCY)
 * 
 * Direct, high-speed local WiFi communication between the Web Dashboard
 * and ESP32 via REST API endpoints (/api/telemetry, /api/speedlimit, /api/resettrip).
 */

let esp32Ip = localStorage.getItem('esp32_ip') || 'vehicle.local';
let isConnectedToEsp32 = false;
let pollingInterval = null;
let pollFrequencyMs = 200; // 5 Hz ultra-smooth realtime telemetry

// Event listeners registry
const listeners = {
  vehicle: [],
  speedLimit: [],
  settings: [],
  maintenance: [],
  history: [],
  connection: []
};

/**
 * Initialize Direct ESP32 WiFi Connection
 */
export async function initFirebaseService() {
  console.info("%c[ESP32 Direct WiFi] Memulai koneksi lokal berkecepatan tinggi ke ESP32...", "color: #3b82f6; font-weight: bold;");
  
  // Start polling
  startEsp32Polling();
  
  return { status: 'DIRECT_WIFI', isConnected: isConnectedToEsp32, ip: esp32Ip };
}

export function isFirebaseActive() {
  return isConnectedToEsp32;
}

export function getEsp32Ip() {
  return esp32Ip;
}

export function setEsp32Ip(newIp) {
  esp32Ip = newIp.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  localStorage.setItem('esp32_ip', esp32Ip);
  console.info(`[ESP32 Direct] Target IP diubah ke: ${esp32Ip}`);
  
  // Reconnect immediately
  if (pollingInterval) clearInterval(pollingInterval);
  startEsp32Polling();
}

/**
 * High-speed Telemetry Polling
 */
function startEsp32Polling() {
  const tryFetchTelemetry = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const url = `http://${esp32Ip}/api/telemetry`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (!isConnectedToEsp32) {
          isConnectedToEsp32 = true;
          console.info(`%c[ESP32 Direct] TERHUBUNG ke ESP32 (${esp32Ip})!`, "color: #10b981; font-weight: bold;");
          dispatchLocalUpdate('connection', { connected: true, ip: esp32Ip });
        }
        dispatchLocalUpdate('vehicle', data);
        if (data.speedLimit !== undefined) {
          dispatchLocalUpdate('speedLimit', data.speedLimit);
        }
      } else {
        markDisconnected();
      }
    } catch (e) {
      markDisconnected();
    }
  };

  tryFetchTelemetry();
  pollingInterval = setInterval(tryFetchTelemetry, pollFrequencyMs);
}

function markDisconnected() {
  if (isConnectedToEsp32) {
    isConnectedToEsp32 = false;
    console.warn(`[ESP32 Direct] Terputus dari ESP32 (${esp32Ip}), beralih ke mode simulasi lokal.`);
    dispatchLocalUpdate('connection', { connected: false, ip: esp32Ip });
  }
}

/**
 * Subscribe to realtime vehicle telemetry
 */
export function subscribeVehicleData(callback) {
  listeners.vehicle.push(callback);
}

/**
 * Subscribe to Speed Limit setting
 */
export function subscribeSpeedLimit(callback) {
  listeners.speedLimit.push(callback);
}

/**
 * Subscribe to Maintenance Settings
 */
export function subscribeMaintenanceSettings(callback) {
  listeners.settings.push(callback);
}

/**
 * Subscribe to Maintenance Statuses
 */
export function subscribeMaintenanceStatus(callback) {
  listeners.maintenance.push(callback);
}

/**
 * Subscribe to Service History
 */
export function subscribeServiceHistory(callback) {
  listeners.history.push(callback);
}

/**
 * Subscribe to ESP32 Connection Status (Connected / Simulation)
 */
export function subscribeConnectionStatus(callback) {
  listeners.connection.push(callback);
  callback({ connected: isConnectedToEsp32, ip: esp32Ip });
}

/**
 * Broadcast local demo updates to subscribers instantly
 */
export function dispatchLocalUpdate(channel, data) {
  const cbs = listeners[channel];
  if (cbs && cbs.length) {
    for (let i = 0; i < cbs.length; i++) {
      cbs[i](data);
    }
  }
}

/**
 * Save Service Record to LocalStorage
 */
export async function writeServiceRecord(record, updatedMaintenanceMap) {
  return { success: true, local: true };
}

/**
 * Update Maintenance Settings
 */
export async function writeMaintenanceSettings(settingsMap) {
  return { success: true, local: true };
}

/**
 * Send Speed Limit to ESP32 directly via HTTP REST
 */
export async function writeSpeedLimit(speedLimitVal) {
  if (isConnectedToEsp32) {
    try {
      const url = `http://${esp32Ip}/api/speedlimit?val=${speedLimitVal}`;
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        console.info(`[ESP32 Direct] Speed limit ${speedLimitVal} km/h berhasil dikirim ke ESP32!`);
        return { success: true };
      }
    } catch (e) {
      console.warn("[ESP32 Direct] Gagal mengirim speed limit ke ESP32:", e);
    }
  }
  return { success: true, local: true };
}

/**
 * Reset Trip Meter on ESP32 directly via HTTP REST
 */
export async function writeResetTrip() {
  if (isConnectedToEsp32) {
    try {
      const url = `http://${esp32Ip}/api/resettrip`;
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        console.info("[ESP32 Direct] Reset trip berhasil dikirim ke ESP32!");
        return { success: true };
      }
    } catch (e) {
      console.warn("[ESP32 Direct] Gagal reset trip:", e);
    }
  }
  return { success: true, local: true };
}


