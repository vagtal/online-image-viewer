import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

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
    if (spinnerOverlay) spinnerOverlay.style.display = 'flex';
    if (spinner) {
      spinner.style.animation = 'none';
      void spinner.offsetWidth; // reflow
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

  // Guarda la última URL base para comparar (sin cache-bust)
  let lastBaseUrl = null;

  // --- CORE LOGIC ---
  const setupRealtimeListener = () => {
    if (unsubscribe) unsubscribe();
    showSpinner();

    unsubscribe = onSnapshot(imageDocRef, (snap) => {
      const data = snap.data();
      const baseUrl = data?.imageUrl || null;

      if (!baseUrl) {
        lastBaseUrl = null;
        fullscreenImage.onload = null;
        fullscreenImage.onerror = null;
        fullscreenImage.src = "";
        showSpinner();
        return;
      }

      // Cache-bust con timestamp del doc (ideal para Cloudinary + caché del navegador)
      const t = data?.timestamp?.toMillis?.() ? data.timestamp.toMillis() : Date.now();
      const finalUrl = `${baseUrl}?t=${t}`;

      // Si cambió la imagen (URL base), forzamos recarga
      if (lastBaseUrl !== baseUrl) {
        lastBaseUrl = baseUrl;
        showSpinner();
        fullscreenImage.onload = hideSpinner;
        fullscreenImage.onerror = imageErrorHandler;
        fullscreenImage.src = finalUrl;
        return;
      }

      // Si no cambió baseUrl, pero por lo que sea no está cargada bien, re-asegura handlers
      if (fullscreenImage.complete && fullscreenImage.naturalHeight !== 0) {
        hideSpinner();
      } else {
        showSpinner();
        fullscreenImage.onload = hideSpinner;
        fullscreenImage.onerror = imageErrorHandler;
        // Reasignar src con cache-bust puede ayudar si se quedó a medias
        fullscreenImage.src = finalUrl;
      }

    }, (error) => {
      console.error("Firestore listener failed:", error);
      showSpinner();
    });
  };

  // --- INITIAL SETUP ---
  setupRealtimeListener();
});