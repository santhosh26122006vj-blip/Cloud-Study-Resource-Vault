# ☁️ Cloud Study Resource Vault

> **A Modern, Serverless Cloud Study Resource Management System for College Cloud Computing**

[![Static Application](https://img.shields.io/badge/Architecture-100%25%20Serverless%20Cloud-blue.svg)](#)
[![Stack](https://img.shields.io/badge/Stack-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS%20%7C%20Firebase-purple.svg)](#)
[![Platform](https://img.shields.io/badge/Platform-Desktop%20%7C%20Tablet%20%7C%20Mobile-emerald.svg)](#)

---

## 📖 1. Project Overview

**Cloud Study Resource Vault** (short name: **Study Vault**) is a centralized cloud platform created for students and faculty to securely store, categorize, discover, and download academic study materials. 

Built exclusively with **HTML5, CSS3, Vanilla JavaScript, and Firebase**, this project demonstrates modern serverless cloud paradigms, zero-backend maintenance, and multi-tenant security without relying on any heavy frontend frameworks (React, Angular, Vue) or server runtimes (Node.js, Express, Python).

### Key Features:
* 🔐 **Cloud Authentication**: Email/password registration, login, session retention via `onAuthStateChanged`, and password reset.
* 📂 **Cloud File Storage**: Resilient multi-part file uploads (PDF, DOCX, PPTX, JPG, PNG) stored in Google Cloud Storage buckets with live progress meters.
* ⚡ **Cloud NoSQL Database**: Real-time study resources, user profiles, tags, categories, and favorites tracked in Cloud Firestore.
* 🔍 **Multi-Attribute Search & Filter**: Instant filtering by Subject, Category, Academic Semester, Resource Type, and keyword search across titles and `#tags`.
* ⭐ **Personalized Favorites**: Private bookmarking vault allowing students to pin critical exam question papers and revision notes.
* ✏️ **Author CRUD Governance**: Full Create, Read, Update, and Delete control for resource owners, with safe confirmation modals.
* 🛡️ **Role-Based Admin Portal**: Admin telemetry dashboard with system statistics, user directory inspection, and administrative resource moderation.
* 📱 **Modern SaaS Responsive Design**: Clean typography, glassmorphism cards, CSS custom property themes, and responsive mobile navigation drawers.

---

## 🏛️ 2. Cloud Computing Architecture Demonstration

```text
+-------------------------------------------------------------------------+
|                                CLIENT TIER                              |
|           HTML5  •  CSS3 (Modern SaaS Theme)  •  Vanilla JavaScript     |
+--------------------+-------------------+--------------------------------+
                     |                   |
        Auth Tokens  |                   |  REST / gRPC WebSockets
                     v                   v
+--------------------+-------------------+--------------------------------+
|                           FIREBASE SERVICES                             |
|                                                                         |
|  +------------------------+  +---------------------------------------+  |
|  | Firebase Authentication|  |            Cloud Firestore            |  |
|  | - Email / Password     |  | - users (Roles: student / admin)      |  |
|  | - Session Management   |  | - resources (Metadata & File URLs)    |  |
|  | - Password Reset       |  | - favorites (User-specific bookmarks) |  |
|  +-----------+------------+  +-------------------+-------------------+  |
|              |                                   |                      |
|              +-----------------+-----------------+                      |
|                                | Signed Uploads                         |
|                                v                                        |
|              +-----------------------------------+                      |
|              |      Firebase Cloud Storage       |                      |
|              | - resources/{userId}/{resId}/...  |                      |
|              | - Elastic Blob Storage Buckets    |                      |
|              +-----------------------------------+                      |
+-------------------------------------------------------------------------+
```

### Mapping of Cloud Computing Concepts:

| Cloud Concept | Implementation in Cloud Study Resource Vault |
| :--- | :--- |
| **IaaS / PaaS Foundation** | Google Cloud Platform underlying infrastructure powering Firebase serverless services. |
| **Cloud Authentication** | Firebase Authentication handles secure credential hashing, session tokens, and identity lifecycle. |
| **Cloud Database (NoSQL)** | Cloud Firestore provides automatic horizontal scaling, document-oriented storage, and ACID transactions. |
| **Cloud Blob Storage** | Firebase Storage provides distributed object storage with elastic capacity and high-availability CDN delivery. |
| **Role-Based Access (RBAC)** | Custom authorization rules evaluate `user.role` from Firestore documents (`student` vs `admin`). |
| **Cloud Security Rules** | Declarative security rules (`firestore.rules` & `storage.rules`) guarantee data isolation at the storage layer. |
| **Elastic Scalability** | Fully serverless: automatically scales from 1 student to 100,000 students without server provisioning. |

---

## 📁 3. Project Structure

```text
Cloud Study Resource Vault/
│
├── index.html              # Modern landing page with hero, features, and cloud architecture
├── login.html              # Authentication sign-in with password reset modal
├── register.html           # Student registration creating Auth and Firestore profile
├── dashboard.html          # Student dashboard with live metrics, recents, and quick actions
├── resources.html          # Main resource browser with multi-attribute search and filters
├── add-resource.html       # File upload form with drag-and-drop and progress bar
├── my-resources.html       # Owner-only resource manager with Edit and Delete
├── favorites.html          # Private bookmarked resources
├── admin.html              # Admin governance, metrics, user directory, and moderation
│
├── css/
│   └── style.css           # Single comprehensive CSS3 stylesheet with variables & responsive grid
│
├── js/
│   ├── firebase-config.js  # Centralized Firebase initialization & modular re-exports
│   ├── auth.js             # Authentication controller and role guards
│   ├── ui.js               # Reusable toasts, modals, confirmation dialogs, and formatters
│   ├── resource-service.js # CRUD operations for Cloud Firestore & Firebase Storage
│   ├── dashboard.js        # Dashboard telemetry and recently added cards
│   ├── resources.js        # Search, multi-criteria filter, and sorting controller
│   ├── add-resource.js     # File upload dropzone, validation, and storage task tracker
│   ├── my-resources.js     # Resource owner edit/delete manager
│   ├── favorites.js        # Bookmarked resources controller
│   ├── admin.js            # Admin moderation and telemetry controller
│   └── demo-data.js        # 1-Click college curriculum sample resource generator
│
├── firestore.rules         # Production Firestore security rules
├── storage.rules           # Production Firebase Storage security rules
└── README.md               # Complete project documentation and viva guide
```

---

## 🚀 4. Step-by-Step Setup Guide

### Step 1: Create a Firebase Project
1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or **Create a project**).
3. Name your project (e.g. `cloud-study-vault-demo`).
4. Disable Google Analytics (optional) and click **Create Project**.

### Step 2: Register a Web Application
1. In your Firebase project overview, click the Web icon (`</>`) to add an app.
2. Enter an app nickname (e.g., `Study Vault Web`).
3. Leave "Firebase Hosting" unchecked for now and click **Register app**.
4. Firebase will display your `firebaseConfig` object. Keep this tab open.

### Step 3: Enable Firebase Authentication
1. In the Firebase console left sidebar, click **Build** > **Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab, click **Email/Password**.
4. Toggle **Enable** (keep Email link / passwordless disabled) and click **Save**.

### Step 4: Create Cloud Firestore Database
1. In the left sidebar, click **Build** > **Firestore Database**.
2. Click **Create database**.
3. Choose a location closest to your region (e.g., `asia-south1` or `us-central1`).
4. Choose **Start in production mode** (or **Start in test mode** for initial setup).
5. Click **Create**.

### Step 5: Enable Firebase Cloud Storage
1. In the left sidebar, click **Build** > **Storage**.
2. Click **Get Started**.
3. Select **Start in production mode** (or test mode) and choose your bucket region.
4. Click **Done**.

### Step 6: Paste Firebase Configuration
Open `js/firebase-config.js` in your code editor and replace the placeholder keys:

```javascript
export const firebaseConfig = {
  apiKey: "AIzaSyD-EXAMPLE-YOUR-REAL-API-KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789"
};
```

> **Note:** The application includes a fallback demo mode. If credentials are not yet configured, a helpful notification banner guides you to `README.md` while allowing local previewing.

### Step 7: Deploy Security Rules
In the Firebase Console:
1. **Firestore Rules**: Go to **Firestore Database** > **Rules**, paste the contents of `firestore.rules`, and click **Publish**.
2. **Storage Rules**: Go to **Storage** > **Rules**, paste the contents of `storage.rules`, and click **Publish**.

### Step 8: How to Create the First Admin Account
1. Open the application in your browser and register a new user on `register.html` (e.g. `admin@college.edu`).
2. Go to the [Firebase Console](https://console.firebase.google.com/) > **Firestore Database**.
3. Under the `users` collection, locate the document corresponding to your newly created account.
4. Edit the `role` field value from `"student"` to `"admin"`.
5. Now, logging in with `admin@college.edu` will automatically redirect you to `admin.html` with full administrative privileges!

---

## 💻 5. Running the Application Locally

Because this application uses standard browser ES Modules (`type="module"`), it must be served over an HTTP server (to prevent browser CORS restrictions on `file:///` URLs):

### Option A: VS Code Live Server (Recommended)
1. Install the **Live Server** extension in Visual Studio Code.
2. Right-click `index.html` and select **Open with Live Server**.

### Option B: Node.js `npx serve`
```bash
npx serve .
```

### Option C: Python Built-in HTTP Server
```bash
# Python 3
python -m http.server 8000
```
Open your browser at `http://localhost:8000`.

---

## 🌐 6. Deploying to Firebase Hosting

You can deploy the static web application to Google's worldwide CDN using Firebase Hosting:

1. Install Firebase CLI (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```
2. Log in to your Google Account:
   ```bash
   firebase login
   ```
3. Initialize hosting in the project directory:
   ```bash
   firebase init
   ```
   - Select: **Hosting: Configure files for Firebase Hosting**
   - Choose: **Use an existing project** (select your project)
   - Public directory: `.` (type a single dot for current folder)
   - Configure as single-page app: `No`
   - Set up automatic builds: `No`
4. Deploy the application:
   ```bash
   firebase deploy
   ```
5. Your project will be live at `https://your-project-id.web.app`!

---

## 📚 7. Sample College Resources (1-Click Demo)

To facilitate presentations and viva demonstrations for college examiners, click the **"Load Demo College Resources"** button located on the **Dashboard** or **Admin Portal**.

This instantly generates the 7 standard university curriculum resources:
1. **Cloud Computing Unit 1 Notes: Fundamentals & Virtualization** *(PDF)*
2. **Cloud Computing Unit 2 Notes: Cloud Architecture & Storage Services** *(PDF)*
3. **Cloud Computing End-Semester Question Paper (2024)** *(PDF)*
4. **Cloud Security & Identity Access Management Presentation** *(PPTX)*
5. **Database Management Systems Complete Unit Notes** *(PDF)*
6. **Computer Networks Mid-Term Question Paper with Solutions** *(PDF)*
7. **Java Programming & Object-Oriented Design Lecture Notes** *(DOCX)*

---

## ✅ 8. Evaluation & Testing Checklist

Use this checklist during project evaluation:

- [x] **Registration**: Register a student with name, email, password, and password confirmation.
- [x] **Firestore User Doc**: Verifiable user document created in `users/{userId}` with role `"student"`.
- [x] **Login / Auth Guard**: Unauthenticated users blocked from entering `dashboard.html`.
- [x] **Dashboard Telemetry**: Metrics dynamically calculate total resources, my resources, favorites, and question papers.
- [x] **Upload Resource**: Upload PDF/DOC file to Firebase Storage with live percentage progress bar.
- [x] **External Link Support**: Option to save YouTube tutorials or web resources without file upload.
- [x] **Browse & Filter**: Filter resources by Category, Subject, Semester, and Type.
- [x] **Instant Search**: Search across titles, subjects, descriptions, and tags.
- [x] **Favorites**: Click ⭐ to bookmark; verify addition to `favorites.html` and Firestore `favorites` collection.
- [x] **My Resources**: Edit resource details; delete with confirmation dialog.
- [x] **Admin Gate**: Regular students attempting to navigate to `admin.html` are blocked and redirected to dashboard.
- [x] **Admin Governance**: Admin can view user registry, inspect telemetry, and delete unwanted uploads.
- [x] **Responsive Mobile**: Navigation collapses into smooth mobile drawer on screens below 768px.
- [x] **Pure Vanilla Stack**: Verified zero usage of React, Vue, Tailwind, Bootstrap, Node backend, or external servers.

---

## 👨‍💻 Academic Project Details

* **Project Title**: Cloud Study Resource Vault
* **Subject**: Cloud Computing
* **Architecture Pattern**: 3-Tier Serverless Cloud Web Application
* **License**: MIT Academic Open Source
