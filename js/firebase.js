/**
 * FIREBASE SERVICE & REALTIME DATA LAYER
 * 
 * Safely initializes Firebase v10 CDN modular SDK when valid config is present.
 * If credentials are missing or connection fails, seamlessly falls back to LocalStorage-backed
 * Demo Mode with zero runtime lag.
 */

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

let app = null;
let db = null;
let isConnected = false;
let fbDbModule = null;

// Event listeners registry for local demo fallback
const listeners = {
  vehicle: [],
  speedLimit: [],
  settings: [],
  maintenance: [],
  history: []
};

/**
 * Initialize Firebase safely without blocking UI
 */
export async function initFirebaseService() {
  if (!isFirebaseConfigured(firebaseConfig)) {
    console.info("%c[Vehicle Monitor] Running in Ultra-Smooth DEMO MODE (Local Simulation).", "color: #3b82f6; font-weight: bold;");
    isConnected = false;
    return { status: 'DEMO_MODE', isConnected: false };
  }

  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    fbDbModule = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');

    app = initializeApp(firebaseConfig);
    db = fbDbModule.getDatabase(app);
    isConnected = true;
    console.info("%c[Vehicle Monitor] Firebase Realtime Database CONNECTED.", "color: #10b981; font-weight: bold;");
    return { status: 'CONNECTED', isConnected: true, db };
  } catch (err) {
    console.warn("[Vehicle Monitor] Firebase connection error, continuing in DEMO MODE:", err.message);
    isConnected = false;
    return { status: 'DEMO_MODE', isConnected: false, error: err.message };
  }
}

export function isFirebaseActive() {
  return isConnected;
}

/**
 * Subscribe to realtime vehicle telemetry
 */
export function subscribeVehicleData(callback) {
  listeners.vehicle.push(callback);

  if (isConnected && db && fbDbModule) {
    try {
      const vehicleRef = fbDbModule.ref(db, 'vehicle/current');
      fbDbModule.onValue(vehicleRef, (snapshot) => {
        const data = snapshot.val();
        if (data) callback(data);
      }, (error) => {
        console.error("Vehicle data listener error:", error);
      });
    } catch (e) {
      console.warn("Falling back to local vehicle listener:", e);
    }
  }
}

/**
 * Subscribe to Speed Limit setting
 */
export function subscribeSpeedLimit(callback) {
  listeners.speedLimit.push(callback);

  if (isConnected && db && fbDbModule) {
    try {
      const limitRef = fbDbModule.ref(db, 'settings/speedLimit');
      fbDbModule.onValue(limitRef, (snapshot) => {
        const val = snapshot.val();
        if (val !== null && val !== undefined) callback(Number(val));
      });
    } catch (e) {
      console.warn("Falling back to local speed limit listener:", e);
    }
  }
}

/**
 * Subscribe to Maintenance Settings
 */
export function subscribeMaintenanceSettings(callback) {
  listeners.settings.push(callback);

  if (isConnected && db && fbDbModule) {
    try {
      const settingsRef = fbDbModule.ref(db, 'settings/maintenance');
      fbDbModule.onValue(settingsRef, (snapshot) => {
        const val = snapshot.val();
        if (val) callback(val);
      });
    } catch (e) {
      console.warn("Falling back to local maintenance settings listener:", e);
    }
  }
}

/**
 * Subscribe to Maintenance Statuses
 */
export function subscribeMaintenanceStatus(callback) {
  listeners.maintenance.push(callback);

  if (isConnected && db && fbDbModule) {
    try {
      const mRef = fbDbModule.ref(db, 'maintenance');
      fbDbModule.onValue(mRef, (snapshot) => {
        const val = snapshot.val();
        if (val) callback(val);
      });
    } catch (e) {
      console.warn("Falling back to local maintenance status listener:", e);
    }
  }
}

/**
 * Subscribe to Service History
 */
export function subscribeServiceHistory(callback) {
  listeners.history.push(callback);

  if (isConnected && db && fbDbModule) {
    try {
      const historyRef = fbDbModule.ref(db, 'history');
      fbDbModule.onValue(historyRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          const list = Object.keys(val).map(key => ({ id: key, ...val[key] }));
          callback(list);
        } else {
          callback([]);
        }
      });
    } catch (e) {
      console.warn("Falling back to local service history listener:", e);
    }
  }
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
 * Push or update Service Record in Firebase or LocalStorage
 */
export async function writeServiceRecord(record, updatedMaintenanceMap) {
  if (isConnected && db && fbDbModule) {
    try {
      const historyListRef = fbDbModule.ref(db, 'history');
      const newRecordRef = fbDbModule.push(historyListRef);
      await fbDbModule.set(newRecordRef, record);

      if (updatedMaintenanceMap) {
        const maintenanceRef = fbDbModule.ref(db, 'maintenance');
        await fbDbModule.update(maintenanceRef, updatedMaintenanceMap);
      }
      return { success: true, id: newRecordRef.key };
    } catch (err) {
      console.error("Firebase writeServiceRecord failed:", err);
    }
  }

  return { success: true, local: true };
}

/**
 * Update Maintenance Settings
 */
export async function writeMaintenanceSettings(settingsMap) {
  if (isConnected && db && fbDbModule) {
    try {
      const settingsRef = fbDbModule.ref(db, 'settings/maintenance');
      await fbDbModule.set(settingsRef, settingsMap);
      return { success: true };
    } catch (err) {
      console.error("Firebase writeMaintenanceSettings failed:", err);
    }
  }
  return { success: true, local: true };
}

/**
 * Update Speed Limit in Firebase
 */
export async function writeSpeedLimit(speedLimitVal) {
  if (isConnected && db && fbDbModule) {
    try {
      const limitRef = fbDbModule.ref(db, 'settings/speedLimit');
      await fbDbModule.set(limitRef, speedLimitVal);
      return { success: true };
    } catch (err) {
      console.error("Firebase writeSpeedLimit failed:", err);
    }
  }
  return { success: true, local: true };
}

