# Cloud Study Resource Vault

A student-focused study resource sharing web app built with HTML, CSS, Vanilla JavaScript, Firebase Authentication, and Cloud Firestore.

## Features
- Student registration and login
- Upload PDF, PPT, PPTX, DOC, DOCX and TXT study resources
- Store small uploaded files directly in Firestore (no Firebase Storage)
- Browse, search, filter and open/download resources
- My Resources for resources uploaded by the signed-in student
- Edit and delete your own resources
- Favorites
- Responsive dashboard

## Firebase
Enable Email/Password Authentication and Firestore. Publish the included `firestore.rules`.

This project intentionally does not use Firebase Cloud Storage. Uploaded files are stored as Base64 data inside Firestore and should therefore be kept small.

## Run
Use `start.bat` or any local HTTP server.
