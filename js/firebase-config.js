/**
 * FIREBASE CONFIGURATION
 * 
 * Replace placeholders below with your actual Firebase Project credentials.
 * If left as placeholders, the dashboard will automatically run in DEMO MODE
 * with full local state simulation, so no errors will occur in Live Server.
 */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
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
