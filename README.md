# STEELSCAN — Industrial Coil Code OCR System

![STEELSCAN HMI Banner](https://img.shields.io/badge/System-STEELSCAN%20HMI-00E5FF?style=for-the-badge&logo=react)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI%205.0-009688?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB?style=for-the-badge&logo=react)
![Python](https://img.shields.io/badge/OCR%20Engine-OpenCV%20%2B%20PaddleOCR-3776AB?style=for-the-badge&logo=python)
![License](https://img.shields.io/badge/License-Proprietary-FF3366?style=for-the-badge)

**STEELSCAN** is an enterprise-grade industrial web application purpose-built for steel plant floor operations. Designed to run on ruggedized tablets, operator kiosks, and workstation PCs situated near heavy, high-luminance machinery, STEELSCAN automates the optical recognition of numeric coil identification codes printed circularly on iron coils.

---

## 🌍 Live Deployment

- **Frontend (Vercel):** [https://steelscan.vercel.app](https://steelscan.vercel.app)
- **Backend API (Render):** [https://steelscan-backend-e2ub.onrender.com](https://steelscan-backend-e2ub.onrender.com)

---

## 🛠️ Architecture Overview

STEELSCAN follows a decoupled client-server architecture with stateful JWT authentication, real-time metrics, and lightweight embedded data persistence.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Industrial Operator / Kiosk                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │  React 18 + Vite (Port 3001)  │
                    │  - Precision Foundry Dark HMI │
                    │  - Zustand Global Stores     │
                    │  - Live Camera & File Upload  │
                    └───────────────┬───────────────┘
                                    │ REST API / JWT
                    ┌───────────────┴───────────────┐
                    │   FastAPI Backend (Port 8000) │
                    │  - Auth & Role Permissions    │
                    │  - Async OCR Pipeline         │
                    │  - SQLite / SQLAlchemy ORM    │
                    └───────────────────────────────┘
```

### Tech Stack

#### 🖥️ Frontend
- **Framework**: React 18, Vite 5
- **Styling**: Tailwind CSS with custom **Precision Foundry** Dark HMI theme
- **Animations**: Framer Motion
- **State Management**: Zustand
- **Camera & Media**: `react-webcam`
- **HTTP & Auth**: Axios with automatic JWT injection and 401 token refresh/interception
- **Icons**: Lucide React

#### ⚙️ Backend
- **Framework**: FastAPI (Python 3.10+)
- **Data Layer**: SQLite via SQLAlchemy ORM
- **Security & Auth**: OAuth2 Password Flow + JWT (`passlib` with bcrypt, `python-jose`)
- **OCR Engine**: OpenCV (image preprocessing, contrast enhancement, circular unwarping) + PaddleOCR / EasyOCR
- **Server**: Uvicorn ASGI

---

## ✨ Core Features

1. **Circular OCR Recognition**: Specialized image preprocessing to deskew, unwarp, and isolate numeric digits printed on steel coil faces.
2. **Industrial HMI UX**: High-contrast, anti-glare dark UI with scanline overlays, high-visibility cyan action triggers, and color-coded status badges.
3. **Dual Input Modes**: Seamlessly switch between live camera scanning, file uploads, and manual code overrides for degraded prints.
4. **Role-Based Access Control (RBAC)**:
   - **Operator (`employee`)**: Perform scans, review results, enter manual overrides, search records.
   - **Administrator (`admin`)**: Manage user accounts, perform CSV bulk imports, purge test data, and view real-time system metrics.
5. **Traceability & Audit Logs**: Records log created timestamps, operator details, confidence scores, and source types (camera, upload, manual).
6. **Data Export & Batch Import**: Upload bulk historical record CSV files and export filtered record views.

---

## 📁 Directory Structure

```text
.
├── backend/                        # FastAPI Application Server
│   ├── app/
│   │   ├── api/                    # Route endpoints (auth, users, scan, records, upload)
│   │   ├── core/                   # Security, JWT, hashing, configuration
│   │   ├── db/                     # SQLAlchemy models, sessions, database initialization
│   │   ├── services/               # OCR engine pipeline and image preprocessing
│   │   └── main.py                 # FastAPI application entrypoint
│   ├── requirements.txt            # Python dependencies
│   ├── steelscan.db                # SQLite database (auto-generated)
│   └── venv/                       # Python Virtual Environment
│
├── frontend/                       # React 18 + Vite Single Page Application
│   ├── src/
│   │   ├── api/                    # Axios client services & endpoints
│   │   ├── components/             # Reusable HMI components (Scanner, Tables, Modals, Badges)
│   │   ├── hooks/                  # Custom React hooks (Keyboard shortcuts, Backend status polling)
│   │   ├── layouts/                # Main HMI Layout with sidebar & status bar
│   │   ├── pages/                  # Scanner, Records, Admin, and Login pages
│   │   ├── store/                  # Zustand global state (Auth, Scanner, Records, Toast)
│   │   ├── index.css               # Precision Foundry custom HMI utilities & styles
│   │   └── main.jsx                # React root application
│   ├── package.json                # Frontend dependencies
│   └── vite.config.js              # Vite server & build configuration
│
├── project.md                      # Detailed technical specification
├── run.bat                         # One-click Windows Batch Launcher
├── run.ps1                         # One-click PowerShell Launcher
└── stop.bat                        # Process terminator script
```

---

## 🚀 Quick Start Guide

### Option 1: One-Click Launchers (Windows)

#### Batch Launcher
Double-click `run.bat` or execute in Command Prompt:
```cmd
.\run.bat
```

#### PowerShell Launcher
Run in PowerShell:
```powershell
.\run.ps1
```

*The launcher automatically boots the FastAPI backend on port **8000**, the React frontend on port **3001**, and opens `http://localhost:3001` in your default web browser.*

#### Stopping Services
To stop both backend and frontend processes cleanly:
```cmd
.\stop.bat
```

---

### Option 2: Manual Setup & Execution

#### 1. Backend Setup (FastAPI)
```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Windows CMD:
call venv\Scripts\activate.bat

# Install dependencies
pip install -r requirements.txt

# Launch FastAPI application
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Backend API will be accessible at `http://localhost:8000`.  
Swagger documentation available at `http://localhost:8000/docs`.

#### 2. Frontend Setup (React + Vite)
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend UI will be accessible at `http://localhost:3001`.

---

## 🔑 Administrator Provisioning & Authentication

STEELSCAN initializes the system administrator on first startup strictly via environment variables:

1. Configure `ADMIN_USERNAME` and `ADMIN_PASSWORD` in your backend `.env` file (minimum 10 characters).
2. When the backend boots, it creates the administrator account if one does not already exist.
3. Upon first login, users must change their temporary password before accessing operational endpoints.
4. Shift operators (`employee`) are created securely by administrators via the User Management panel.

### 🗄️ Database Setup & Migrations Notice
- **PostgreSQL**: For persistent deployments on Render, supply `DATABASE_URL` (e.g. `postgresql://user:pass@host:5432/dbname`).
- **Local SQLite Recreation**: Due to schema hardening (token rotation, daily vision quotas, and security flags), any existing local `steelscan.db` SQLite files must be deleted and recreated on startup.
- **Alembic Migrations**: Formal database migration scripts with Alembic will be introduced in **Phase 4**.

> 🔒 **Security Notice**: Never commit plaintext passwords or secrets to Git. Refer to [SECURITY.md](SECURITY.md) for deployment hardening guidelines.

---

## 🌐 API Endpoint Summary

### Authentication (`/auth`)
- `POST /auth/token` — Authenticate user & retrieve JWT access token
- `GET /auth/me` — Fetch current logged-in user profile
- `PUT /auth/change-password` — Change password for authenticated user

### User Management (`/users`) — Admin Only
- `GET /users/` — List all registered users
- `POST /users/` — Register a new user
- `PUT /users/{user_id}/role` — Change user role (`admin` ↔ `employee`)
- `DELETE /users/{user_id}` — Delete user account

### Scanning & OCR (`/scan`)
- `POST /scan` — Upload image payload for circular OCR processing and code extraction

### Records Management (`/records`)
- `GET /records` — Query scan history with date, shift, confidence, and search filters
- `POST /records` — Create a new manual coil record entry
- `DELETE /records/{record_id}` — Delete a record (Admin only)
- `POST /records/bulk-delete` — Bulk delete test or old records (Admin only)

### Bulk Operations (`/upload`) — Admin Only
- `POST /upload/csv` — Bulk upload historical records via CSV file

### System & Health
- `GET /health` — Health check endpoint with uptime tracking
- `GET /metrics` — OCR request volume, success rates, and average latency

---

## 🎨 Design System — Precision Foundry Theme

STEELSCAN uses a custom industrial HMI color palette configured in `frontend/tailwind.config.js`:

| Token | Hex | Application |
|---|---|---|
| `industrial-950` | `#0F1113` | High-contrast background base |
| `industrial-900` | `#1A1C1E` | Card & Panel background container |
| `scan-cyan` | `#00E5FF` | Primary action triggers, active tabs, focus glow |
| `signal-green` | `#00E676` | High-confidence scans, live camera status |
| `molten-amber` | `#FF6D00` | Processing states, manual overrides |
| `alert-red` | `#FF3366` | Low confidence alerts, errors, deletions |

---

## 📄 License

Proprietary Software — Developed for industrial factory floor deployments.
