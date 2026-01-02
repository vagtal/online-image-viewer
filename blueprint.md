
# Project Blueprint

## Overview

This project is a sophisticated image viewer and gallery application. It allows users to upload, view, manage, and sync images across devices using Firebase Firestore for real-time data storage. The application is designed with a modern, responsive interface that adapts to various screen sizes, provides clear user feedback via loading indicators, and is architected to handle large image files by splitting them into manageable chunks.

## Style, Design, and Features

### Visual Design
*   **Theme:** Dark mode aesthetic with a clean, minimalist layout.
*   **Typography:** Uses 'Segoe UI' or similar sans-serif fonts for readability.
*   **Color Palette:** A simple palette of dark grays for the background, white for text, and a vibrant blue for interactive elements. A green `Sync` button provides a clear call to action.
*   **Layout:** Responsive design that adjusts for desktop, tablet, and mobile devices.
*   **Icons:** Utilizes symbols for intuitive icons for actions like rotate and fullscreen.
*   **User Feedback:** A loading spinner overlay provides clear visual feedback during asynchronous operations, preventing user uncertainty.

### Core Features
*   **Image Upload:** Users can select local image files (e.g., JPEG, PNG) to view.
*   **Large Image Support:** Images that exceed Firestore's 1 MiB document limit are automatically split into smaller chunks.
*   **Loading Indicators:** A spinner is displayed during saving, deleting, and loading of large images to inform the user the application is working.
*   **Image Preview:** An instant preview of the selected image is displayed.
*   **Image Rotation:** Users can rotate the previewed image in 90-degree increments.
*   **Fullscreen Mode:** A modal window allows for a fullscreen, distraction-free view of the image.
*   **Real-time Sync with Firestore:** Changes (additions, deletions) are reflected across all connected clients instantly.
*   **Image Navigation:** "Previous" and "Next" buttons allow users to cycle through the stored images.
*   **Image Deletion:** Users can delete the currently viewed image.

### Technical Implementation
*   **Frontend:** Built with vanilla HTML, CSS, and JavaScript (ES Modules).
*   **Database:** Uses Firebase Firestore for real-time data persistence.
*   **Large File Handling:** Implements a "chunking" strategy for large base64 strings.
*   **Asynchronous Feedback:** The UI now includes a spinner overlay controlled via JavaScript to improve user experience during database operations.
*   **Modern JavaScript:** Leverages async/await for asynchronous operations.
*   **Responsive Design:** Employs CSS media queries to adapt the layout.

## Development History

### Enhancement: Add Loading Spinner for Async Operations (Latest)
*   **Problem:** Asynchronous operations like saving or deleting images could take a moment, leaving the user without feedback and creating uncertainty.
*   **Plan & Execution:**
    1.  **HTML:** Added a `div` for the spinner overlay to `index.html`, hidden by default.
    2.  **CSS:** Created styles in `style.css` for the overlay and a spinning animation for the indicator.
    3.  **JavaScript (`main.js`):**
        *   Implemented `showSpinner()` and `hideSpinner()` helper functions.
        *   Wrapped the core logic in `saveImage`, `deleteCurrentImage`, and the chunk-loading part of `showImageAtIndex` in `try...finally` blocks.
        *   Called `showSpinner()` at the beginning of these operations and `hideSpinner()` in the `finally` block to ensure it always gets hidden, even if an error occurs.
    4.  **Verify:** Confirmed the spinner appears reliably during all relevant database interactions, improving the user experience.

### Bug Fix: Image Preview Disappearing on Save/Rotate
*   **Problem:** The preview would go blank when saving/rotating a large image due to a race condition.
*   **Execution:** Refactored `showImageAtIndex` to be non-destructive, loading new image data in the background and only updating the preview once the data is fully validated and ready.

### Architecture: Large Image Support via Chunking
*   **Problem:** Saving images >1 MiB failed due to Firestore limits.
*   **Execution:** Implemented a "chunking" system to split large images into smaller documents in a subcollection.

### Bug Fix: Image Duplication on Rotate/Save
*   **Problem:** Saving an existing, rotated image created a duplicate entry.
*   **Execution:** The `saveImage` function was updated to use `updateDoc` for existing images.

### Enhancement: Responsive Layout Fix & Mobile View
*   **Problem:** Mobile layouts were not applying correctly and were not user-friendly.
*   **Execution:** Added the `meta viewport` tag and overhauled the CSS media queries for a better mobile experience.
