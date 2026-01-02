import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "REDACTED",
  authDomain: "notion-db-35221.firebaseapp.com",
  projectId: "notion-db-35221",
  storageBucket: "notion-db-35221.appspot.com",
  messagingSenderId: "421459617996",
  appId: "1:421459617996:web:58f1f3ffaf9694877c7a69"
};
const IMGUR_CLIENT_ID = "546c25a59c58ad7";
const IMGUR_UPLOAD_URL = "https://api.imgur.com/3/image";

// --- INITIALIZATION ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const imageDocRef = doc(db, "syncedImage", "current");

// --- DOM ELEMENTS ---
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const syncButton = document.getElementById('syncButton');
const deleteButton = document.getElementById('deleteButton');
const maximizeButton = document.getElementById('maximizeButton');
const rotateLeftButton = document.getElementById('rotateLeftButton');
const rotateRightButton = document.getElementById('rotateRightButton');
const modal = document.getElementById('fullscreenModal');
const fullscreenImage = document.getElementById('fullscreenImage');
const closeModalButton = document.querySelector('.close');
const spinnerOverlay = document.getElementById('spinner-overlay');

// --- STATE ---
let currentRotation = 0;
let localImageFile = null;

// --- SPINNER CONTROLS ---
const showSpinner = () => { spinnerOverlay.style.display = 'flex'; };
const hideSpinner = () => { spinnerOverlay.style.display = 'none'; };

// --- IMAGE MANIPULATION (CANVAS) ---

/**
 * Takes an image file and a rotation in degrees, and returns a Promise
 * that resolves with a new Blob of the rotated image.
 */
const getRotatedImageBlob = (imageFile, degrees) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = URL.createObjectURL(imageFile);

    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Swap width and height for 90 or 270 degree rotations
      const radians = degrees * Math.PI / 180;
      const isVertical = Math.abs(degrees) % 180 === 90;
      canvas.width = isVertical ? image.height : image.width;
      canvas.height = isVertical ? image.width : image.height;

      // Move the rotation point to the center of the canvas
      ctx.translate(canvas.width / 2, canvas.height / 2);
      // Rotate the canvas
      ctx.rotate(radians);
      // Draw the image, offsetting it so its center is at the canvas center
      ctx.drawImage(image, -image.width / 2, -image.height / 2);

      // Get the result as a Blob
      canvas.toBlob(resolve, 'image/png');
    };

    image.onerror = (err) => reject(err);
  });
};


// --- CORE LOGIC ---

const handleLocalImageSelect = (file) => {
  if (!file) {
    localImageFile = null;
    return;
  }
  localImageFile = file;
  imagePreview.src = URL.createObjectURL(file);
  currentRotation = 0; // Reset rotation on new image select
  updateRotationStyles();
};

const syncImageToServer = async () => {
  if (!localImageFile) {
    alert("Please select an image first.");
    return;
  }
  showSpinner();

  try {
    // 1. Get the (potentially rotated) image blob from the canvas
    const imageToUpload = await getRotatedImageBlob(localImageFile, currentRotation);

    // 2. Upload the new blob to Imgur
    const formData = new FormData();
    formData.append("image", imageToUpload, localImageFile.name);

    const response = await fetch(IMGUR_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
      },
      body: formData,
    });

    if (!response.ok) throw new Error(`Imgur API Error: ${response.statusText}`);

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Imgur upload failed: ${result.data.error}`);
    }

    // 3. Sync the new Imgur URL to Firestore
    await setDoc(imageDocRef, {
      imageUrl: result.data.link,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to upload and sync image:", error);
    alert(`Error uploading image: ${error.message}`);
  } finally {
    hideSpinner();
  }
};

const deleteImageForAll = async () => {
    showSpinner();
    try {
        await setDoc(imageDocRef, { 
            imageUrl: null,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Failed to delete image:", error);
        alert("Error deleting image. Please try again.");
    } finally {
        hideSpinner();
    }
}

const setupRealtimeListener = () => {
  onSnapshot(imageDocRef, (doc) => {
    const data = doc.data();
    const syncedImageUrl = data ? data.imageUrl : null;

    if (!syncedImageUrl) {
        imagePreview.onerror = null;
        imagePreview.src = "";
        fullscreenImage.src = "";
        localImageFile = null; 
        return;
    }

    if (imagePreview.src !== syncedImageUrl) {
      showSpinner();
      imagePreview.src = syncedImageUrl;
      fullscreenImage.src = syncedImageUrl;
      
      // When a new image is synced from the server, the local rotation should be reset.
      currentRotation = 0;
      updateRotationStyles();
      
      imagePreview.onload = () => hideSpinner();
      imagePreview.onerror = () => {
        hideSpinner();
        alert("Failed to load the synced image from Imgur.");
      };
    }
  }, (error) => {
    console.error("Firestore listener failed:", error);
    alert("Error connecting to the database. Real-time sync might not work.");
  });
};

// --- UI FUNCTIONS ---

const updateRotationStyles = () => {
    const rotationStyle = `rotate(${currentRotation}deg)`;
    imagePreview.style.transform = rotationStyle;
    fullscreenImage.style.transform = rotationStyle;

    const isVertical = Math.abs(currentRotation) % 180 === 90;
    fullscreenImage.classList.toggle('fullscreen-image-vertical', isVertical);
}

const rotatePreview = (degrees) => {
  if (!imagePreview.src) return;
  currentRotation += degrees;
  updateRotationStyles();
};

const openModal = () => {
  if (imagePreview.src) {
    fullscreenImage.src = imagePreview.src;
    updateRotationStyles(); 
    modal.style.display = "flex";
  }
};

const closeModal = () => {
  modal.style.display = "none";
};

// --- EVENT LISTENERS ---
imageInput.addEventListener('change', (e) => handleLocalImageSelect(e.target.files[0]));
syncButton.addEventListener('click', syncImageToServer);
deleteButton.addEventListener('click', deleteImageForAll);
rotateLeftButton.addEventListener('click', () => rotatePreview(-90));
rotateRightButton.addEventListener('click', () => rotatePreview(90));
maximizeButton.addEventListener('click', openModal);
closeModalButton.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

// --- INITIAL SETUP ---
setupRealtimeListener();
