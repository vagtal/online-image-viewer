
// --- UNREGISTER ALL SERVICE WORKERS ---
// This is a critical step to remove any corrupted or problematic service workers.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('Service Worker unregistered successfully');
    }
  }).catch(function(err) {
    console.error('Service Worker unregistration failed: ', err);
  });
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    console.log('DOMContentLoaded fired. Initializing app.');

    // --- CONFIGURATION ---
    const firebaseConfig = {
      apiKey: "REDACTED",
      authDomain: "notion-db-35221.firebaseapp.com",
      projectId: "notion-db-35221",
      storageBucket: "notion-db-35221.appspot.com",
      messagingSenderId: "421459617996",
      appId: "1:421459617996:web:58f1f3ffaf9694877c7a69"
    };

    // --- INITIALIZATION ---
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const imageDocRef = doc(db, "syncedImage", "current");

    // --- DOM ELEMENTS ---
    const fullscreenImage = document.getElementById('fullscreenImage');
    const spinnerOverlay = document.getElementById('spinner-overlay');
    const spinner = document.querySelector('.spinner');
    let unsubscribe;

    // --- HELPERS ---
    const showSpinner = () => {
      if (spinnerOverlay) {
        spinnerOverlay.style.display = 'flex';
      }
      if (spinner) {
        spinner.style.animation = 'none';
        void spinner.offsetWidth; // Trigger a reflow
        spinner.style.animation = ''; 
      }
    };
    const hideSpinner = () => { if (spinnerOverlay) spinnerOverlay.style.display = 'none'; };

    // --- ERROR HANDLER for image loading ---
    const imageErrorHandler = () => {
      console.error("Failed to load synced image.");
      fullscreenImage.onload = null;
      fullscreenImage.onerror = null;
      fullscreenImage.src = "";
      showSpinner();
    };

    // --- CORE LOGIC ---
    const setupRealtimeListener = () => {
      if (unsubscribe) {
        unsubscribe();
      }
      showSpinner();

      unsubscribe = onSnapshot(imageDocRef, (doc) => {
        const data = doc.data();
        const syncedImageUrl = data ? data.imageUrl : null;

        if (!syncedImageUrl) {
          fullscreenImage.onload = null;
          fullscreenImage.onerror = null;
          fullscreenImage.src = "";
          showSpinner();
          return;
        }

        if (fullscreenImage.src !== syncedImageUrl) {
          showSpinner();
          fullscreenImage.onload = hideSpinner;
          fullscreenImage.onerror = imageErrorHandler;
          fullscreenImage.src = syncedImageUrl;
        } else {
          if (fullscreenImage.complete && fullscreenImage.naturalHeight !== 0) {
            hideSpinner();
          } else {
            showSpinner();
            fullscreenImage.onload = hideSpinner;
            fullscreenImage.onerror = imageErrorHandler;
          }
        }
      }, (error) => {
        console.error("Firestore listener failed:", error);
        showSpinner();
      });
    };

    // --- INITIAL SETUP ---
    setupRealtimeListener();
});
