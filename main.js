import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy, serverTimestamp, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "REDACTED",
  authDomain: "notion-db-35221.firebaseapp.com",
  projectId: "notion-db-35221",
  storageBucket: "notion-db-35221.appspot.com",
  messagingSenderId: "421459617996",
  appId: "1:421459617996:web:58f1f3ffaf9694877c7a69"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const maximizeButton = document.getElementById('maximizeButton');
const saveButton = document.getElementById('saveButton');
const deleteButton = document.getElementById('deleteButton');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const syncButton = document.getElementById('syncButton');
const modal = document.getElementById('fullscreenModal');
const fullscreenImage = document.getElementById('fullscreenImage');
const closeModalButton = document.querySelector('.close');
const rotateLeftButton = document.getElementById('rotateLeftButton');
const rotateRightButton = document.getElementById('rotateRightButton');

// State variables
let images = [];
let currentIndex = -1;
let currentBase64 = "";
let currentHash = "";
let currentRotation = 0;

// Helper function to hash a string using SHA-256
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Firestore functions
async function saveImage() {
    if (!currentBase64) {
        alert("No image to save!");
        return;
    }

    let finalBase64 = currentBase64;
    const isPng = currentBase64.startsWith('data:image/png');

    if (currentRotation % 360 !== 0) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        await new Promise(resolve => { img.onload = resolve; img.src = currentBase64; });

        const radians = currentRotation * Math.PI / 180;
        const absCos = Math.abs(Math.cos(radians));
        const absSin = Math.abs(Math.sin(radians));

        canvas.width = img.width * absCos + img.height * absSin;
        canvas.height = img.width * absSin + img.height * absCos;

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(radians);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);

        if (isPng) {
            finalBase64 = canvas.toDataURL('image/png');
        } else {
            finalBase64 = canvas.toDataURL('image/jpeg', 0.9);
        }
    }

    const FIRESTORE_MAX_BYTES = 1048487;
    if (finalBase64.length > FIRESTORE_MAX_BYTES) {
        if (isPng) {
            alert("Save failed: The rotated PNG image is too large. Please use a smaller image.");
        } else {
            alert("Save failed: The image is too large, even after compression.");
        }
        return;
    }
    
    const finalHash = await hashString(finalBase64);

    try {
        // This logic handles both new images and existing ones, making it perfect for 'Sync'.
        // It always results in the target image having the latest timestamp.
        const imagesRef = collection(db, "images");
        const q = query(imagesRef, where("hash", "==", finalHash));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const existingDocId = querySnapshot.docs[0].id;
            const docRef = doc(db, "images", existingDocId);
            await updateDoc(docRef, { 
                base64: finalBase64, // Ensure rotated version is saved
                createdAt: serverTimestamp() 
            });
            alert("Sync successful: Image already existed and was updated for all devices.");
        } else {
            await addDoc(imagesRef, {
                base64: finalBase64,
                hash: finalHash,
                createdAt: serverTimestamp()
            });
            alert("Sync successful: New image saved and sent to all devices.");
        }
    } catch (error) {
        console.error("Error saving/syncing image: ", error);
        alert("Failed to save or sync image. See console for details.");
    }
}

async function deleteCurrentImage() {
    if (currentIndex < 0 || currentIndex >= images.length) {
        alert("No image to delete!");
        return;
    }
    try {
        await deleteDoc(doc(db, "images", images[currentIndex].id));
    } catch (error) {
        console.error("Error deleting image: ", error);
    }
}

function setupRealtimeListener() {
  const imagesCollection = collection(db, "images");
  const q = query(imagesCollection, orderBy("createdAt", "desc"));

  onSnapshot(q, (querySnapshot) => {
    console.log("Real-time update received from Firestore.");
    
    images = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const latestImageIndex = images.length > 0 ? 0 : -1;
    showImageAtIndex(latestImageIndex);

    if (modal.style.display === "flex") {
      if (images.length > 0) {
        fullscreenImage.src = images[0].base64;
        fullscreenImage.style.transform = 'rotate(0deg)';
        fullscreenImage.style.height = '100vh';
        fullscreenImage.style.width = 'auto';
      } else {
        closeModal();
      }
    }
  });
}

// UI functions
function showImageAtIndex(index) {
  currentRotation = 0;
  imagePreview.style.transform = 'rotate(0deg)';

  if (index >= 0 && index < images.length) {
    currentIndex = index;
    const imageData = images[index];
    imagePreview.src = imageData.base64;
    currentBase64 = imageData.base64;
    currentHash = imageData.hash;
  } else {
    currentIndex = -1;
    imagePreview.src = "";
    currentBase64 = "";
    currentHash = "";
  }
}

function rotatePreview(degrees) {
    currentRotation += degrees;
    imagePreview.style.transform = `rotate(${currentRotation}deg)`;
}

function openModal() {
  if (currentBase64) {
    fullscreenImage.style.transform = `rotate(${currentRotation}deg)`;
    if (Math.abs(currentRotation) % 180 === 90) {
      fullscreenImage.style.height = 'auto';
      fullscreenImage.style.width = '100vh';
    } else {
      fullscreenImage.style.height = '100vh';
      fullscreenImage.style.width = 'auto';
    }
    fullscreenImage.src = currentBase64;
    modal.style.display = "flex"; 
  }
}

function closeModal() {
  modal.style.display = "none";
  fullscreenImage.src = "";
  fullscreenImage.style.height = 'auto';
  fullscreenImage.style.width = 'auto';
}

// Event Listeners
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = async (event) => {
        currentRotation = 0;
        imagePreview.style.transform = 'rotate(0deg)';
        currentBase64 = event.target.result;
        imagePreview.src = currentBase64;
        currentIndex = -1;
        e.target.value = null;
    };
    reader.readAsDataURL(file);
  }
});

rotateLeftButton.addEventListener('click', () => rotatePreview(-90));
rotateRightButton.addEventListener('click', () => rotatePreview(90));

maximizeButton.addEventListener('click', openModal);
closeModalButton.addEventListener('click', closeModal);
modal.addEventListener('click', (event) => {
    if (event.target === modal) {
        closeModal();
    }
});

saveButton.addEventListener('click', saveImage);
syncButton.addEventListener('click', saveImage); // Sync button uses the same powerful save logic
deleteButton.addEventListener('click', deleteCurrentImage);

prevButton.addEventListener('click', () => {
  const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
  if(images.length > 0) showImageAtIndex(newIndex);
});

nextButton.addEventListener('click', () => {
  const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
  if(images.length > 0) showImageAtIndex(newIndex);
});

// Initial setup
setupRealtimeListener();
