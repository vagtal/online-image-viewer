
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // --- SERVICE WORKER REGISTRATION ---
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((registration) => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        }, (err) => {
          console.log('ServiceWorker registration failed: ', err);
        });
      });
    }

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

    // --- HELPERS ---
    const showSpinner = () => { if(spinnerOverlay) spinnerOverlay.style.display = 'flex'; };
    const hideSpinner = () => { if(spinnerOverlay) spinnerOverlay.style.display = 'none'; };

    // --- CORE LOGIC ---
    const setupRealtimeListener = () => {
      showSpinner(); // Start with the spinner on

      onSnapshot(imageDocRef, (doc) => {
        const data = doc.data();
        const syncedImageUrl = data ? data.imageUrl : null;

        // --- This is the fix ---
        // If the image is deleted in Firestore
        if (!syncedImageUrl) {
          // Detach event handlers to prevent the error loop
          fullscreenImage.onload = null;
          fullscreenImage.onerror = null;
          // Now, safely clear the image source
          fullscreenImage.src = "";
          showSpinner(); // Show spinner to indicate waiting for a new image
          return;
        }

        // If a new or different image URL is received
        if (fullscreenImage.src !== syncedImageUrl) {
          showSpinner(); // Show spinner while the new image loads
          
          // Set up the event handlers for the new image
          fullscreenImage.onload = hideSpinner;
          fullscreenImage.onerror = () => {
            console.error("Failed to load synced image.");
            // Detach handlers, clear src, and wait for a new image
            fullscreenImage.onload = null;
            fullscreenImage.onerror = null;
            fullscreenImage.src = "";
            showSpinner();
          };

          // Finally, set the new image source
          fullscreenImage.src = syncedImageUrl;
        } else {
          // If the image URL is the same and it's already loaded, hide the spinner
          if (fullscreenImage.complete) {
             hideSpinner();
          }
        }
      }, (error) => {
        console.error("Firestore listener failed:", error);
        showSpinner(); // On error, show spinner and hope for reconnection
      });
    };

    // --- INITIAL SETUP ---
    setupRealtimeListener();
});
