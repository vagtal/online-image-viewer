import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where, orderBy, serverTimestamp, updateDoc, onSnapshot, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const spinnerOverlay = document.getElementById('spinner-overlay');

// State variables
let images = [];
let currentIndex = -1;
let currentBase64 = "";
let currentHash = "";
let currentRotation = 0;

// Constants for chunking
const FIRESTORE_MAX_BYTES = 1048487; // 1 MiB
const CHUNK_SIZE = FIRESTORE_MAX_BYTES - 100; // Leave space for metadata

// --- SPINNER CONTROLS ---
function showSpinner() { spinnerOverlay.style.display = 'flex'; }
function hideSpinner() { spinnerOverlay.style.display = 'none'; }

// --- HELPERS ---
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- ROBUST ASYNC OPERATIONS ---
async function saveImage() {
    if (!currentBase64) {
        alert("No image to save!");
        return;
    }

    showSpinner();
    let alertMessage = "";

    try {
        let finalBase64 = currentBase64;
        let finalHash = currentHash; 

        if (currentRotation % 360 !== 0) {
          finalBase64 = await getRotatedBase64(currentBase64, currentRotation);
          finalHash = await hashString(finalBase64);
        }
        
        const imagesRef = collection(db, "images");
        const existingImage = (currentIndex !== -1) ? images[currentIndex] : null;

        if (existingImage && existingImage.hash !== finalHash) {
            const docRef = doc(db, "images", existingImage.id);
            await overwriteImageInPlace(docRef, finalBase64, finalHash);
            alertMessage = "Sync successful: Image was updated in place.";
        } else {
            const q = query(imagesRef, where("hash", "==", finalHash));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docRef = querySnapshot.docs[0].ref;
                if (!existingImage || existingImage.id !== querySnapshot.docs[0].id) {
                    await updateDoc(docRef, { order: Date.now() });
                }
                alertMessage = "Sync successful: Image already existed and was updated.";
            } else {
                const newDocRef = doc(imagesRef);
                await uploadAndCommitImage(newDocRef, finalBase64, finalHash, Date.now());
                alertMessage = "Sync successful: New image saved.";
            }
        }
        currentHash = finalHash; // Update currentHash after successful save
    } catch (error) {
        console.error("Error saving/syncing image: ", error);
        alertMessage = `Failed to save or sync image. Error: ${error.message}`;
    } finally {
        hideSpinner();
        if (alertMessage) alert(alertMessage);
        currentRotation = 0; // Reset rotation after any save attempt
    }
}

async function overwriteImageInPlace(docRef, base64, hash) {
    const batch = writeBatch(db);

    const chunksRef = collection(docRef, "chunks");
    const chunksSnapshot = await getDocs(chunksRef);
    chunksSnapshot.forEach(chunkDoc => batch.delete(chunkDoc.ref));

    const updateData = { hash, order: Date.now() };

    if (base64.length < FIRESTORE_MAX_BYTES) {
        updateData.base64 = base64;
        updateData.isChunked = false;
        updateData.chunkCount = null;
    } else {
        const chunks = [];
        for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
            chunks.push(base64.substring(i, i + CHUNK_SIZE));
        }

        for(let i = 0; i < chunks.length; i++) {
            const chunkDocRef = doc(chunksRef, `chunk_${i}`);
            batch.set(chunkDocRef, { part: i, data: chunks[i] });
        }

        updateData.base64 = "";
        updateData.isChunked = true;
        updateData.chunkCount = chunks.length;
    }
    batch.update(docRef, updateData);
    await batch.commit();
}


async function uploadAndCommitImage(docRef, base64, hash, order) {
    const batch = writeBatch(db);
    const mainDocData = { hash, order, createdAt: serverTimestamp() };

    if (base64.length < FIRESTORE_MAX_BYTES) {
        mainDocData.base64 = base64;
        mainDocData.isChunked = false;
        batch.set(docRef, mainDocData);
    } else {
        const chunks = [];
        for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
            chunks.push(base64.substring(i, i + CHUNK_SIZE));
        }

        const chunksCollectionRef = collection(docRef, "chunks");
        for(let i = 0; i < chunks.length; i++) {
            const chunkDocRef = doc(chunksCollectionRef, `chunk_${i}`);
            batch.set(chunkDocRef, { part: i, data: chunks[i] });
        }

        mainDocData.base64 = ""; 
        mainDocData.isChunked = true;
        mainDocData.chunkCount = chunks.length;
        batch.set(docRef, mainDocData); // Add main doc to the same batch
    }
    await batch.commit(); // Commit everything at once
}

async function deleteImageAtomically(imageToDelete) {
    if (!imageToDelete) return;
    const docRef = doc(db, "images", imageToDelete.id);
    const batch = writeBatch(db);
    if (imageToDelete.isChunked) {
        const chunksSnapshot = await getDocs(collection(docRef, "chunks"));
        chunksSnapshot.forEach(chunkDoc => batch.delete(chunkDoc.ref));
    }
    batch.delete(docRef);
    await batch.commit();
}

async function deleteCurrentImage() {
    if (currentIndex < 0 || currentIndex >= images.length) {
        alert("No image to delete!");
        return;
    }
    showSpinner();
    try {
        await deleteImageAtomically(images[currentIndex]);
    } catch (error) {
        console.error("Error deleting image: ", error);
        alert("Error deleting image.");
    } finally {
        hideSpinner();
    }
}

async function showImageAtIndex(index) {
    if (index < 0 || index >= images.length) {
        currentIndex = -1;
        imagePreview.src = "";
        currentBase64 = "";
        currentHash = "";
        return;
    }
    const imageData = images[index];
    if (currentIndex === index && currentHash === imageData.hash && !imagePreview.src.startsWith('data:')) return;


    imagePreview.style.transform = 'rotate(0deg)';
    currentRotation = 0;
    let loadedBase64 = "";
    try {
        if (imageData.isChunked) {
            showSpinner();
            const chunksQuery = query(collection(doc(db, "images", imageData.id), "chunks"), orderBy("part"));
            const querySnapshot = await getDocs(chunksQuery);
            if (querySnapshot.docs.length < imageData.chunkCount) {
                 console.error(`Incomplete chunks for image ${imageData.id}.`);
                 hideSpinner();
                 return;
            }
            loadedBase64 = querySnapshot.docs.map(d => d.data().data).join('');
        } else {
            loadedBase64 = imageData.base64;
        }
        if (loadedBase64) {
            imagePreview.src = loadedBase64;
            currentBase64 = loadedBase64;
            currentHash = imageData.hash;
            currentIndex = index;
        }
    } catch (error) {
        console.error("Error loading image data:", error);
    } finally {
        if (imageData.isChunked) hideSpinner();
    }
}

async function getRotatedBase64(base64, rotation) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    await new Promise((resolve, reject) => { 
        img.onload = resolve; 
        img.onerror = reject;
        img.src = base64; 
    });
    const rad = rotation * Math.PI / 180, cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
    canvas.width = img.width * cos + img.height * sin;
    canvas.height = img.width * sin + img.height * cos;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    return base64.startsWith('data:image/png') ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);
}

function setupRealtimeListener() {
  const q = query(collection(db, "images"), orderBy("order", "desc"));

  onSnapshot(q, (snapshot) => {
    let newImages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    let nextIndex = 0;
    if (currentHash) {
      const foundIndex = newImages.findIndex(img => img.hash === currentHash);
      if (foundIndex !== -1) {
        nextIndex = foundIndex;
      } else {
        currentHash = ""; 
      }
    }

    images = newImages;

    if (images.length > 0) {
        showImageAtIndex(nextIndex);
    } else {
        showImageAtIndex(-1);
    }
    
    if (modal.style.display === "flex") {
      images.length > 0 ? openModal() : closeModal();
    }
  }, (error) => console.error("Realtime listener failed: ", error));
}

function rotatePreview(degrees) {
    currentRotation += degrees;
    imagePreview.style.transform = `rotate(${currentRotation}deg)`;
}

function openModal() {
  if (currentBase64) {
    fullscreenImage.style.transform = `rotate(${currentRotation}deg)`;
    const isVertical = Math.abs(currentRotation) % 180 === 90;
    fullscreenImage.style.maxWidth = isVertical ? '100vh' : '100vw';
    fullscreenImage.style.maxHeight = isVertical ? '100vw' : '100vh';
    fullscreenImage.src = currentBase64;
    modal.style.display = "flex"; 
  }
}

function closeModal() {
  modal.style.display = "none";
}

// Event Listeners
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    currentIndex = -1; // Reset index immediately
    const reader = new FileReader();
    reader.onload = async (event) => {
        currentRotation = 0;
        imagePreview.style.transform = 'rotate(0deg)';
        currentBase64 = event.target.result;
        imagePreview.src = currentBase64;
        currentHash = await hashString(currentBase64);
        e.target.value = null;
    };
    reader.readAsDataURL(file);
  }
});

rotateLeftButton.addEventListener('click', () => rotatePreview(-90));
rotateRightButton.addEventListener('click', () => rotatePreview(90));
maximizeButton.addEventListener('click', openModal);
closeModalButton.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
saveButton.addEventListener('click', saveImage);
syncButton.addEventListener('click', saveImage);
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
