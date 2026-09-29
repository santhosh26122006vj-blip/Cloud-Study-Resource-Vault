# Cloud Study Resource Vault

A student-only cloud study resource application built with HTML, CSS, Vanilla JavaScript and Firebase.

## Features
- Student email/password registration and login
- Private per-student resource vault
- Upload and store study resource metadata/files
- Search, filter and sort your own resources
- Favorites for your own resources
- Image-to-PDF utility
- Firebase Authentication + Cloud Firestore security
- Student-only access with no administrator portal or role

## Privacy model
Every resource document contains `uploadedBy`, which is the Firebase Authentication UID of the student who uploaded it. Firestore rules only allow that UID to read, create, update or delete its own resources.

## Firebase setup
1. Enable Email/Password under Firebase Authentication > Sign-in method.
2. Add your Firebase web configuration in `js/firebase-config.js`.
3. Create Firestore Database.
4. Publish `firestore.rules`.
5. If using Firebase Storage, publish `storage.rules`.

## Firestore collections
- `users/{uid}` — private profile for the signed-in student.
- `resources/{resourceId}` — resources owned by one student through `uploadedBy`.
- `favorites/{uid_resourceId}` — private favorites.

## Important
Existing resource documents created before owner-based security was enabled must contain the correct `uploadedBy` Firebase UID. Documents without an owner UID are intentionally inaccessible under the security rules.
