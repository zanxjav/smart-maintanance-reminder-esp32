/**
 * FIREBASE CONFIGURATION - VEHICLE MONITOR SCADA
 * 
 * Auto-configured from New Dedicated Firebase Project: vehicle-monitor-esp32
 */

const firebaseConfig = {
  apiKey: "AIzaSyCQ-QHh2d5FnRcJiHyxrjd4vwYgVOFuiKY",
  authDomain: "vehicle-monitor-esp32.firebaseapp.com",
  databaseURL: "https://vehicle-monitor-esp32-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "vehicle-monitor-esp32",
  storageBucket: "vehicle-monitor-esp32.firebasestorage.app",
  messagingSenderId: "879479057002",
  appId: "1:879479057002:web:b29654b3d331025224b813"
};

/**
 * Validates if the Firebase configuration contains real credentials.
 * @param {Object} config 
 * @returns {boolean}
 */
function isFirebaseConfigured(config = firebaseConfig) {
  if (!config) return false;
  const placeholders = [
    "YOUR_API_KEY",
    "YOUR_PROJECT",
    "YOUR_SENDER_ID",
    "YOUR_APP_ID"
  ];
  
  if (!config.apiKey || !config.databaseURL || !config.projectId) return false;
  
  return !placeholders.some(p => 
    config.apiKey.includes(p) || 
    config.databaseURL.includes(p) || 
    config.projectId.includes(p)
  );
}

// Export for ES modules and window fallback
if (typeof window !== 'undefined') {
  window.firebaseConfig = firebaseConfig;
  window.isFirebaseConfigured = isFirebaseConfigured;
}

export { firebaseConfig, isFirebaseConfigured };
