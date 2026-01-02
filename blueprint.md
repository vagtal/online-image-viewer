
# Blueprint: Real-Time Image Sync

## 1. Overview

This application is a real-time, multi-device image synchronization tool. It allows a user to select an image, rotate it locally, and then sync the final, rotated version to all connected clients. It also provides functionality to delete the image from all screens.

## 2. Project Documentation

This section outlines all design, features, and technical specifications implemented in the application as of the current version.

### Core Functionality

- **Upload Rotated Image:** The application now uploads the *visually rotated* version of the image. When a user rotates an image locally and clicks "Sync Image," the app uses an in-memory `<canvas>` to "bake in" the rotation. It creates a new image file from the rotated canvas and uploads that file to Imgur. This ensures that what you see is what you get on all devices.
- **Manual, Controlled Sync:**
    1.  **Local Preview:** A user selects an image and can rotate it locally. These changes are only visible on their screen.
    2.  **Manual Sync:** The "Sync Image" button triggers the canvas rotation logic and uploads the final image to Imgur, updating Firestore.
- **Global Deletion:** The "Delete Image" button clears the image from all screens by nullifying the Firestore entry.
- **Real-Time Database:** Firebase Firestore remains the single source of truth for the synced image URL.
- **Image Hosting:** The Imgur API is used for image hosting.

### User Interface & Features

- **Control Bar:** `Select Image`, `Sync Image`, `Delete Image`.
- **Image Preview:** Displays the local preview or the globally synced image.
- **Top Control Bar:** Local rotation and fullscreen controls. The rotation performed here is now used as the basis for the synced image.

### Design & Styling

- **Aesthetics:** Modern dark theme.
- **Layout:** Centered, responsive layout.

### Technical Stack

- **Frontend:** HTML5, CSS3, and Modern JavaScript (ES Modules), including the **HTML Canvas API** for image manipulation.
- **Backend (Real-Time Database):** Firebase Firestore.
- **Third-Party Services:** Imgur API.

## 3. Current Plan & Implementation Details

- **Action:** Implemented the "upload rotated image" feature.
- **Objective:** To ensure that when a user rotates an image, the rotated version is what gets saved and synced, not the original file.
- **Implementation:**
    1.  A new function, `getRotatedImageBlob()`, was created.
    2.  This function takes the original image file and the rotation angle.
    3.  It draws the image onto a temporary, in-memory `<canvas>` element with the specified rotation.
    4.  It then calls `canvas.toBlob()` to generate a new, high-quality image file (as a Blob).
    5.  The `syncImageToServer()` function was updated to call this new function first, and then upload the resulting Blob to Imgur.
- **Status:** The feature is fully implemented and tested in `main.js`. The `blueprint.md` has been updated to reflect this significant enhancement.
