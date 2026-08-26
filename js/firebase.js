/**
 * FIREBASE REALTIME SERVICE (OFFICIAL MODULAR V10 SDK)
 * 
 * Directly connected to Firebase Project: greenhouse-firebase-56abd
 * Seamlessly synchronizes telemetry and settings between ESP32 and Web Dashboard.
 */

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

let app = null;
let db = null;
let isConnected = false;
let fbDbModule = null;

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
 * Initialize Firebase Realtime Database
 */
export async function initFirebaseService() {
  if (!isFirebaseConfigured(firebaseConfig)) {
    console.info("%c[Vehicle SCADA] Firebase config not set. Operating in Demo Mode.", "color: #3b82f6; font-weight: bold;");
    isConnected = false;
    dispatchLocalUpdate('connection', { connected: false, mode: 'DEMO' });
    return { status: 'DEMO_MODE', isConnected: false };
  }

  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    fbDbModule = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');

    app = initializeApp(firebaseConfig);
    db = fbDbModule.getDatabase(app);
    isConnected = true;
    console.info("%c[Vehicle SCADA] Firebase Realtime Database TERHUBUNG!", "color: #10b981; font-weight: bold;");
    dispatchLocalUpdate('connection', { connected: true, mode: 'FIREBASE', projectId: firebaseConfig.projectId });

    // Setup active listeners once connected
    setupRemoteListeners();

    return { status: 'CONNECTED', isConnected: true, db };
  } catch (err) {
    console.warn("[Vehicle SCADA] Firebase connection error, fallback to Demo Mode:", err.message);
    isConnected = false;
    dispatchLocalUpdate('connection', { connected: false, mode: 'DEMO' });
    return { status: 'DEMO_MODE', isConnected: false, error: err.message };
  }
}

export function isFirebaseActive() {
  return isConnected;
}

function setupRemoteListeners() {
  if (!isConnected || !db || !fbDbModule) return;

  // 1. Vehicle Telemetry Listener (/vehicle/current)
  try {
    const vehicleRef = fbDbModule.ref(db, 'vehicle/current');
    fbDbModule.onValue(vehicleRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        dispatchLocalUpdate('vehicle', data);
        if (data.speedLimit !== undefined) {
          dispatchLocalUpdate('speedLimit', Number(data.speedLimit));
        }
      }
    }, (err) => {
      console.error("Telemetry listener error:", err);
    });
  } catch (e) {
    console.warn("Error setting vehicle listener:", e);
  }

  // 2. Speed Limit Listener (/settings/speedLimit)
  try {
    const limitRef = fbDbModule.ref(db, 'settings/speedLimit');
    fbDbModule.onValue(limitRef, (snapshot) => {
      const val = snapshot.val();
      if (val !== null && val !== undefined) {
        dispatchLocalUpdate('speedLimit', Number(val));
      }
    });
  } catch (e) {
    console.warn("Error setting speed limit listener:", e);
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
  callback({ connected: isConnected, mode: isConnected ? 'FIREBASE' : 'DEMO' });
}

/**
 * Broadcast local or remote updates to subscribers
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
 * Write Speed Limit to Firebase Realtime Database
 */
export async function writeSpeedLimit(speedLimitVal) {
  if (isConnected && db && fbDbModule) {
    try {
      const limitRef = fbDbModule.ref(db, 'settings/speedLimit');
      await fbDbModule.set(limitRef, Number(speedLimitVal));
      console.info(`[Firebase] Speed limit ${speedLimitVal} km/h berhasil disimpan ke Firebase.`);
      return { success: true };
    } catch (err) {
      console.error("[Firebase] Gagal update speed limit:", err);
    }
  }
  return { success: true, local: true };
}

/**
 * Reset Trip Meter in Firebase
 */
export async function writeResetTrip() {
  if (isConnected && db && fbDbModule) {
    try {
      const tripRef = fbDbModule.ref(db, 'vehicle/current/trip');
      await fbDbModule.set(tripRef, 0.0);
      return { success: true };
    } catch (err) {
      console.error("[Firebase] Gagal reset trip:", err);
    }
  }
  return { success: true, local: true };
}

/**
 * Maintenance & Service History persistence
 */
export async function writeServiceRecord(record, updatedMaintenanceMap) {
  if (isConnected && db && fbDbModule) {
    try {
      const historyListRef = fbDbModule.ref(db, 'history');
      const newRecordRef = fbDbModule.push(historyListRef);
      await fbDbModule.set(newRecordRef, record);
      return { success: true, id: newRecordRef.key };
    } catch (err) {
      console.error("Firebase writeServiceRecord error:", err);
    }
  }
  return { success: true, local: true };
}

export async function writeMaintenanceSettings(settingsMap) {
  if (isConnected && db && fbDbModule) {
    try {
      const settingsRef = fbDbModule.ref(db, 'settings/maintenance');
      await fbDbModule.set(settingsRef, settingsMap);
      return { success: true };
    } catch (err) {
      console.error("Firebase writeMaintenanceSettings error:", err);
    }
  }
  return { success: true, local: true };
}
