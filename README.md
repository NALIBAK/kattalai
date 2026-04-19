# 🕉️ Kattalai Management System

A robust, **local-first**, and privacy-focused temple management system designed to manage devotees, subscription renewals, and temple communications with ease. Built with modern web technologies, it ensures your data stays in your hands while providing cloud-sync capabilities.

---

## 🏗️ Technical Architecture

### 🛡️ Privacy & Storage (Local-First)
Unlike traditional web apps that store data on a remote server, Kattalai uses an **Offline-First** architecture:
- **IndexedDB**: All devotee records, payment history, and categories are stored directly in your browser's private database.
- **Zustand**: Fast, lightweight global state management for reactive UI updates across the app.
- **PWA (Progressive Web App)**: The app can be installed on your phone or desktop and works entirely offline.

### 🔄 Logic Flow
1. **User Input**: Admin adds/edits devotee data via forms.
2. **Local Persistence**: Data is instantly saved to IndexedDB versioning.
3. **Cloud Sync**: A background sync process (every 60s of inactivity) uploads a secure, encrypted backup to **your own Google Drive**.
4. **Broadcast**: WhatsApp integration allows direct messaging to devotees based on their subscription status.

---

## 📁 Project Structure Map

```text
kattalai-source/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── Navigation.tsx   # Sidebar/Mobile bottom bar
│   │   ├── AppLayout.tsx    # Main layout with branding (ॐ)
│   │   ├── PlanGate.tsx     # Logic for "Pro" feature restrictions
│   │   └── ...
│   ├── db/               # Database Layer
│   │   └── index.ts         # IndexedDB schema (v3) & CRUD helpers
│   ├── store/            # State Management
│   │   └── index.ts         # Global stores (Auth, Settings, Devotees)
│   ├── pages/            # View Components
│   │   ├── Dashboard.tsx    # High-level metrics & stats
│   │   ├── Broadcast.tsx    # WhatsApp messaging hub
│   │   ├── DevoteeForm.tsx  # Dynamic entry with city suggestions
│   │   ├── Settings.tsx     # Admin configs & Template Manager
│   │   └── ...
│   ├── utils/            # Shared logic
│   │   └── googleDrive.ts   # Google GIS integration & upload logic
│   ├── data/             # Static reference data (e.g., Pincodes)
│   ├── App.tsx           # Route definitions & Theme provider
│   ├── main.tsx          # Application entry point
│   └── index.css         # Modern, premium styling (Dark mode first)
├── public/               # Static assets & PWA icons
├── index.html            # Main template with Sanskrit font support
└── vite.config.ts        # PWA & Build configuration
```

---

## ☁️ External Integrations

### 1. Google Drive Auto-Sync
This app connects to your Google Account to store backups.
- **Google Cloud Project**: Requires a project with the **Google Drive API** enabled.
- **OAuth2**: Uses the **Google Identity Services (GIS)** for secure, client-side authentication.
- **Storage Scope**: Requests `drive.file` permission (can only access files created by this app).

### 2. WhatsApp Desktop/Mobile
The **Broadcast Utility** uses standard URL schemes (`whatsapp://send`) to initiate messages. No paid API is required; it uses your local WhatsApp session.

### 3. Nominatim (OpenStreetMap)
The **Devotee Form** uses Nominatim for free, privacy-respecting geocoding to find GPS coordinates from street addresses.

---

## 🛠️ Environment Setup

Before building or running the app locally, you must provide your Google Client ID.

1. Create a `.env` file in the root directory.
2. Add your **Google OAuth2 Client ID**:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-id-here.apps.googleusercontent.com
   ```
   > [!IMPORTANT]
   > Make sure the "Authorized JavaScript Origins" in your Google Cloud Console includes your local dev URL (e.g., `http://localhost:5173`) and your final production URL.

---

## 📍 Important Concepts for Developers

### 🔄 Database Migrations
When adding new features that require data changes (like the **Message Template Manager**), increment the version number in `src/db/index.ts` and add a migration block in the `upgrade` handler.

### 🌓 Theme System
The app uses a binary **Light/Dark** theme system controlled by the `data-theme` attribute on the HTML root. Styles are defined in `index.css` using CSS variables (e.g., `var(--surface)`).

### 📱 PWA Build
The app uses `vite-plugin-pwa`. When building for production (`npm run build`), ensure the icon assets are present in the `public/` folder to generate a valid manifest.

### 📏 Build Limits
In `vite.config.ts`, the `chunkSizeWarningLimit` is adjusted to allow for large assets like Leaflet maps and PWA service workers.

---

## 🚀 Deployment

The app is optimized for hosting on **Vercel**, **Netlify**, or **GitHub Pages**. Since it is a client-side Vite app, it simply needs to serve the `dist/` folder.

**Developed with 🕉️ by SSKAB**
