// Firebase Configuration - Centralized configuration file
// This allows for easier maintenance and updating of Firebase credentials

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCcthdcxH-xleb3vZxHIs7nfWT9Lo9CG84",
  authDomain: "r8y-33be8.firebaseapp.com",
  projectId: "r8y-33be8",
  storageBucket: "r8y-33be8.appspot.com",
  messagingSenderId: "477787173296",
  appId: "1:477787173296:web:cd7bd1ca355085b4d6e675",
  measurementId: "G-CFYZEQ6QGK"
};

// For legacy Firebase SDK (compat version)
function initializeFirebaseLegacy() {
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase Legacy SDK initialized");
    return true;
  }
  console.error("Firebase Legacy SDK not found");
  return false;
}

// For modular Firebase SDK
function getFirebaseConfig() {
  return firebaseConfig;
}

// Initialize legacy Firebase if script is loaded in a page that has firebase compat SDK
document.addEventListener('DOMContentLoaded', function() {
  if (typeof firebase !== 'undefined') {
    initializeFirebaseLegacy();
  }
}); 