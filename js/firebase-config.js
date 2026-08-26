/**
 * FIREBASE CONFIGURATION
 * 
 * Auto-configured from Firebase Project: greenhouse-firebase-56abd
 */

const firebaseConfig = {
  apiKey: "AIzaSyAxPO-OEL2cnlQstspnjkyIq-3VOzYK8KM",
  authDomain: "greenhouse-firebase-56abd.firebaseapp.com",
  databaseURL: "https://greenhouse-firebase-56abd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "greenhouse-firebase-56abd",
  storageBucket: "greenhouse-firebase-56abd.firebasestorage.app",
  messagingSenderId: "347929965464",
  appId: "1:347929965464:web:36e778ff71f8a370b431ed"
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
