/**
 * FIREBASE SERVICE & REALTIME DATA LAYER
 * 
 * Safely initializes Firebase v10 CDN modular SDK when valid config is present.
 * If credentials are missing or connection fails, seamlessly falls back to LocalStorage-backed
 * Demo Mode with zero runtime errors.
 */

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

let app = null;
let db = null;
let isConnected = false;

// Event listeners registry for local demo fallback
const listeners = {
  vehicle: [],
  speedLimit: [],
  settings: [],
  maintenance: [],
  history: []
};

/**
 * Initialize Firebase safely
 */
export async function initFirebaseService() {
  if (!isFirebaseConfigured(firebaseConfig)) {
    console.info("%c[Vehicle SCADA] Firebase config is in placeholder state. Operating in DEMO MODE.", "color: #00f0ff; font-weight: bold;");
    isConnected = false;
    return { status: 'DEMO_MODE', isConnected: false };
  }

  try {
    // Dynamic import from Firebase official v10 CDN
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const { getDatabase, ref, onValue, set, push, update } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');

    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    isConnected = true;
    console.info("%c[Vehicle SCADA] Firebase Realtime Database CONNECTED successfully.", "color: #00e676; font-weight: bold;");
    return { status: 'CONNECTED', isConnected: true, db, ref, onValue, set, push, update };
  } catch (err) {
    console.warn("[Vehicle SCADA] Firebase connection failed, reverting to DEMO MODE:", err.message);
    isConnected = false;
    return { status: 'DEMO_MODE', isConnected: false, error: err.message };
  }
}

export function isFirebaseActive() {
  return isConnected;
}

/**
 * Subscribe to realtime vehicle telemetry (Speed, Odo, Trip, GPS, ESP32, etc.)
 */
export async function subscribeVehicleData(callback) {
  if (isConnected && db) {
    try {
      const { ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
      const vehicleRef = ref(db, 'vehicle/current');
      onValue(vehicleRef, (snapshot) => {
        const data = snapshot.val();
        if (data) callback(data);
      }, (error) => {
        console.error("Vehicle data listener error:", error);
      });
      return;
    } catch (e) {
      console.warn("Falling back to local vehicle listener:", e);
    }
  }

  // Demo mode local bus
  listeners.vehicle.push(callback);
}

/**
 * Subscribe to Speed Limit setting
 */
export async function subscribeSpeedLimit(callback) {
  if (isConnected && db) {
    try {
      const { ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
      const limitRef = ref(db, 'settings/speedLimit');
      onValue(limitRef, (snapshot) => {
        const val = snapshot.val();
        if (val !== null && val !== undefined) callback(Number(val));
      });
      return;
    } catch (e) {
      console.warn("Falling back to local speed limit listener:", e);
    }
  }

  listeners.speedLimit.push(callback);
}

/**
 * Subscribe to Maintenance Settings
 */
export async function subscribeMaintenanceSettings(callback) {
  if (isConnected && db) {
    try {
      const { ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
      const settingsRef = ref(db, 'settings/maintenance');
      onValue(settingsRef, (snapshot) => {
        const val = snapshot.val();
        if (val) callback(val);
      });
      return;
    } catch (e) {
      console.warn("Falling back to local maintenance settings listener:", e);
    }
  }

  listeners.settings.push(callback);
}

/**
 * Subscribe to Maintenance Statuses
 */
export async function subscribeMaintenanceStatus(callback) {
  if (isConnected && db) {
    try {
      const { ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
      const mRef = ref(db, 'maintenance');
      onValue(mRef, (snapshot) => {
        const val = snapshot.val();
        if (val) callback(val);
      });
      return;
    } catch (e) {
      console.warn("Falling back to local maintenance status listener:", e);
    }
  }

  listeners.maintenance.push(callback);
}

/**
 * Subscribe to Service History
 */
export async function subscribeServiceHistory(callback) {
  if (isConnected && db) {
    try {
      const { ref, onValue } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
      const historyRef = ref(db, 'history');
      onValue(historyRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
          const list = Object.keys(val).map(key => ({ id: key, ...val[key] }));
          callback(list);
        } else {
          callback([]);
        }
      });
      return;
    } catch (e) {
      console.warn("Falling back to local service history listener:", e);
    }
  }

  listeners.history.push(callback);
}

/**
 * Broadcast local demo updates to subscribers
 */
export function dispatchLocalUpdate(channel, data) {
  if (listeners[channel]) {
    listeners[channel].forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error(`Error in local listener [${channel}]:`, e);
      }
    });
  }
}

/**
 * Push or update Service Record in Firebase or LocalStorage
 */
export async function writeServiceRecord(record, updatedMaintenanceMap) {
  if (isConnected && db) {
    try {
      const { ref, push, set, update } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
      
      // 1. Add to history
      const historyListRef = ref(db, 'history');
      const newRecordRef = push(historyListRef);
      await set(newRecordRef, record);

      // 2. Update maintenance nodes in bulk
      if (updatedMaintenanceMap) {
        const maintenanceRef = ref(db, 'maintenance');
        await update(maintenanceRef, updatedMaintenanceMap);
      }
      return { success: true, id: newRecordRef.key };
    } catch (err) {
      console.error("Firebase writeServiceRecord failed, saving locally:", err);
    }
  }

  // Local Storage fallback handled by Maintenance Engine
  return { success: true, local: true };
}

/**
 * Update Maintenance Settings in Firebase or LocalStorage
 */
export async function writeMaintenanceSettings(settingsMap) {
  if (isConnected && db) {
    try {
      const { ref, set } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
      const settingsRef = ref(db, 'settings/maintenance');
      await set(settingsRef, settingsMap);
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
  if (isConnected && db) {
    try {
      const { ref, set } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js');
      const limitRef = ref(db, 'settings/speedLimit');
      await set(limitRef, speedLimitVal);
      return { success: true };
    } catch (err) {
      console.error("Firebase writeSpeedLimit failed:", err);
    }
  }
  return { success: true, local: true };
}
