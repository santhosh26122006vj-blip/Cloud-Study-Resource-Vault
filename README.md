# ☁️ Cloud Study Resource Vault

> **A Modern, Serverless Cloud Study Resource Management System for College Cloud Computing**  
> **100% Firebase Spark (Free Tier) Compatible — Zero Firebase Cloud Storage Dependency**

[![Static Application](https://img.shields.io/badge/Architecture-Serverless%20Static%20Web-blue.svg)](#)
[![Stack](https://img.shields.io/badge/Stack-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS%20%7C%20Firebase-purple.svg)](#)
[![Plan](https://img.shields.io/badge/Firebase%20Plan-Spark%20(100%25%20Free)-emerald.svg)](#)
[![Platform](https://img.shields.io/badge/Platform-Desktop%20%7C%20Tablet%20%7C%20Mobile-cyan.svg)](#)

---

## 📖 1. Project Overview

**Cloud Study Resource Vault** is a responsive, cloud-based academic study material repository created for college students and faculty. Students can register, log in, browse lecture notes, search syllabus units, filter by subject, unit, and file type, save bookmarked favorites, and open/download resource materials directly in their browser.

### Key Architecture Principle:
* **ZERO Firebase Cloud Storage:** Firebase Storage requires the Blaze (pay-as-you-go) billing plan. To keep this project **100% free on the Firebase Spark tier**, binary resource files (PDF, PPT, DOC) reside in the project's local `/resources/` folder (or via external URLs), while **Cloud Firestore** stores the structured resource metadata, file paths, and download telemetry.
* **Pure Static Web Stack:** Built exclusively with **HTML5, CSS3, Vanilla JavaScript, Firebase Authentication, and Cloud Firestore**. No React, Vue, Angular, Node.js, Express, PHP, Python, or backend servers.

---

## 🔑 2. Instant Demo Credentials & Roles

| Role | Email | Password | Access & Permissions |
| :--- | :--- | :--- | :--- |
| **Student** | `student@studyvault.edu` | `student123` | Browse published resources, search & filter, bookmark favorites, open/download files. Admin controls are completely restricted. |
| **Admin** | `admin@studyvault.edu` | `admin123` | Full resource management: Add resources, Edit metadata, Delete Firestore documents, Publish/Unpublish toggle, view telemetry metrics. |

> **Tip:** On the `login.html` page, click either **[ 👤 Student Demo ]** or **[ 🛡️ Admin Demo ]** for 1-click instant login!

---

## 🏛️ 3. Cloud Computing Architecture Demonstration

```text
+-------------------------------------------------------------------------+
|                                CLIENT TIER                              |
|           HTML5  •  CSS3 (Modern Responsive Theme)  •  Vanilla JS       |
+--------------------+-------------------+--------------------------------+
                     |                   |
        Auth Tokens  |                   |  REST / WebSockets (gRPC)
                     v                   v
+--------------------+-------------------+--------------------------------+
|                           FIREBASE SERVICES                             |
|                                                                         |
|  +------------------------+  +---------------------------------------+  |
|  | Firebase Authentication|  |            Cloud Firestore            |  |
|  | - Email / Password     |  | - users (Roles: student / admin)      |  |
|  | - Session Management   |  | - resources (Metadata & File Paths)   |  |
|  | - Password Reset       |  | - favorites (User-specific bookmarks) |  |
|  +------------------------+  +---------------------------------------+  |
+-------------------------------------------------------------------------+
                                 |
                                 | Resolves File Path / URL
                                 v
+-------------------------------------------------------------------------+
|                            RESOURCE STORAGE                             |
|  Local Directory: /resources/*.pdf  OR  External Web Links (https://)   |
|  - Opened directly via: window.open(resource.fileUrl, "_blank")         |
+-------------------------------------------------------------------------+
```

---

## 📁 4. Project Structure

```text
Cloud Study Resource Vault/
│
├── index.html              # Landing page highlighting features & cloud architecture
├── login.html              # Login page with 1-click Student & Admin testing buttons
├── register.html           # Student registration creating Auth and Firestore profiles
├── dashboard.html          # Dashboard with live telemetry (Total, Published, Subjects, Units)
├── resources.html          # Student resource browser with search, Subject/Unit filters, and cards
├── admin.html              # Admin Portal with resource table, CRUD actions, and publish toggles
├── add-resource.html       # Admin form to add resources (metadata + file path)
├── favorites.html          # Student private bookmarked resources vault
├── my-resources.html       # Safe redirect router to Admin Portal or Browse Resources
├── image-to-pdf.html       # Authenticated browser-only image-to-PDF utility
│
├── resources/              # Physical study material files (PDFs, PPTs, DOCs)
│   ├── cloud-computing-unit-1.pdf
│   ├── cloud-computing-unit-2.pdf
│   ├── cloud-security-overview.pdf
│   ├── computer-networks-notes.pdf
│   ├── database-management-notes.pdf
│   └── web-technology-notes.pdf
│
├── css/
│   └── style.css           # Modern CSS3 styling (variables, flexbox, grid, tables, modals)
│
├── js/
│   ├── firebase-config.js  # Centralized Firebase initialization (Spark plan compatible)
│   ├── auth.js             # Authentication, session retention, and role-based guards
│   ├── ui.js               # Toast notifications, modals, and formatters
│   ├── resource-service.js # Pure Firestore CRUD operations (Zero Firebase Storage)
│   ├── dashboard.js        # Telemetry metrics and recently added resources
│   ├── resources.js        # Search, filtering by Subject/Unit/Type, and Open handlers
│   ├── admin.js            # Admin management table, CRUD modals, and publish toggles
│   ├── add-resource.js     # Form validation and Firestore document creation
│   ├── favorites.js        # Bookmarked resources controller
│   ├── image-to-pdf.js     # Local image previews, ordering, and PDF generation
│   └── demo-data.js        # 1-Click university sample resources seeder
│
├── firestore.rules         # Security rules: Admin writes, student reads & favorites
├── start.bat               # 1-Click local HTTP server launcher (avoids CORS file:/// errors)
├── upload-to-github.bat    # 1-Click helper to deploy directly to GitHub Pages
└── README.md               # Project documentation and viva guide
```

---

## 🗃️ 5. Resource Data Structure in Cloud Firestore

All study resources are stored in the `resources` collection:

```javascript
{
  title: "Cloud Computing Unit 1",
  subject: "Cloud Computing",
  unit: "Unit 1",
  description: "Introduction to cloud computing concepts and service models.",
  fileName: "cloud-computing-unit-1.pdf",
  fileUrl: "resources/cloud-computing-unit-1.pdf",  // Relative path or external URL
  fileType: "PDF",
  uploadedBy: "admin UID",
  uploaderName: "Administrator",
  createdAt: serverTimestamp(),
  downloadCount: 0,
  isPublished: true
}
```

### How to Add New Study Materials:
1. Place your PDF, PPT, or DOC file inside the project's `/resources/` folder:
   ```text
   resources/my-notes.pdf
   ```
2. Log in as Admin (`admin@studyvault.edu` / `admin123`) and click **Add Resource**.
3. Fill in the form:
   * **Title**: e.g., `Cloud Computing Unit 3 Security Notes`
   * **Subject**: `Cloud Computing`
   * **Unit**: `Unit 3`
   * **File Name**: `my-notes.pdf`
   * **File URL**: `resources/my-notes.pdf` (or an external URL such as `https://...`)
   * **File Type**: `PDF`
   * **Published**: `Yes`
4. Click **Add Resource**. The metadata is immediately saved in Cloud Firestore, and students can view and open the file.

---

## 💻 6. How to Run Locally

Because this project uses standard browser ES Modules (`type="module"`), modern browsers require it to run over an HTTP/HTTPS protocol rather than `file:///`:

### Option A: Double-Click `start.bat` (Easiest)
Simply double-click [`start.bat`](start.bat) in the project directory. It launches a local lightweight web server and opens `http://localhost:3000` automatically.

### Option B: VS Code Live Server
1. Open the project folder in Visual Studio Code.
2. Right-click `index.html` and click **Open with Live Server**.

### Option C: Python HTTP Server
```bash
python -m http.server 3000
```
Open your browser at `http://localhost:3000`.

---

## 🌐 7. Deploying to GitHub Pages (Free Hosting)

1. Double-click [`upload-to-github.bat`](upload-to-github.bat).
2. Enter your GitHub repository URL when prompted.
3. In GitHub: Go to **Settings** > **Pages** > Select Branch: `main` > Click **Save**.
4. In 1 minute, your website will be live worldwide:
   ```text
   https://<your-username>.github.io/<your-repo-name>/
   ```
Because all resource files are committed in `/resources/`, all PDF/PPT files will open perfectly on GitHub Pages!

---

## 🛡️ 8. Firebase Configuration & Firestore Security Rules

### Step 1: Firebase Configuration
In [`js/firebase-config.js`](js/firebase-config.js), verify your project config:
```javascript
export const firebaseConfig = {
  apiKey: "AIzaSyBbZGXvTGaVifVZtaumTYE_rJzExvou2_o",
  authDomain: "cloud-study-resource-vault.firebaseapp.com",
  projectId: "cloud-study-resource-vault",
  storageBucket: "cloud-study-resource-vault.firebasestorage.app",
  messagingSenderId: "985626683684",
  appId: "1:985626683684:web:aae6864f1bf936da7aabb1"
};
```

### Step 2: Deploy Firestore Security Rules
Go to **Firebase Console** > **Firestore Database** > **Rules** and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isAuthenticated() && (
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin') ||
        request.auth.token.email.matches('.*admin.*')
      );
    }

    // Users Collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create, update: if isOwner(userId) || isAdmin();
      allow delete: if isAdmin();
    }

    // Resources Collection
    match /resources/{resourceId} {
      allow read: if isAuthenticated();
      allow create, delete: if isAdmin();
      allow update: if isAdmin() || (
        isAuthenticated() && 
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['downloadCount'])
      );
    }

    // Favorites Collection
    match /favorites/{favoriteId} {
      allow read: if isAuthenticated() && (resource == null || resource.data.userId == request.auth.uid);
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
      allow delete: if isAuthenticated() && resource.data.userId == request.auth.uid;
    }

  }
}
```

---

## ✅ 9. Project Evaluation & Feature Checklist

- [x] **Zero Firebase Storage**: 100% Spark/free tier compliance. No Blaze upgrade required.
- [x] **Local & External File Support**: PDFs/PPTs in `/resources/` or external URLs open directly via `[ Open Resource ]`.
- [x] **Authentication**: Email & Password sign-up and sign-in via Firebase Authentication.
- [x] **Role Separation**:
  - **Admin**: Full resource management (Add, Edit, Delete Firestore docs, Toggle publication status).
  - **Student**: Browse published resources, search, filter by Subject/Unit/Type, save favorites. Admin controls are hidden.
- [x] **Dashboard Telemetry**: Live metrics for Total Resources, Published Resources, Subjects, and Units.
- [x] **Search & Filters**: Instant search across title, subject, unit, description, and file type without page reloads.
- [x] **Sample College Data**: 1-click seeding button to populate standard curriculum notes.
- [x] **Image → PDF Tool**: Combine JPG, PNG, and WebP images into a PDF entirely in-browser; no image uploads.
- [x] **Mobile Responsive**: Fully responsive layout across laptops, tablets, and smartphones.
- [x] **Strict Tech Stack**: HTML5, CSS3, Vanilla JS, Firebase Auth & Firestore only.
