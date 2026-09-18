# STEELSCAN Project Documentation

## Project Overview

**STEELSCAN** is an industrial web application designed for deployment on a steel mill factory floor. It allows operators to scan coil ID codes via OCR (Optical Character Recognition) on tablets or kiosks situated near loud, bright machinery. 

The application has a premium industrial HMI (Human-Machine Interface) design, tailored specifically to function efficiently in a factory environment (inspired by Siemens HMI, Rockwell FactoryTalk, and GE Predix).

### Core Functionality
- **OCR Scanning**: Scans numeric digits (0-9) printed circularly on iron coils.
- **Manual Entry**: Allows operators to manually enter codes if the scanner fails or is unavailable.
- **Record Management**: A comprehensive dashboard to filter, review, and manage scanned/entered records.
- **Admin Dashboard**: Contains system statistics, user management (promoting to admin or deleting users), and bulk operations (e.g., uploading CSVs of historical records, deleting test data).
- **Authentication**: Secure login system with JWT tokens, session management, and role-based access control (Admin vs. Operator).

## Architecture

STEELSCAN follows a decoupled client-server architecture:

### 1. Frontend (React + Vite)
- **Framework**: React 18 using Vite for fast compilation and HMR.
- **Routing**: `react-router-dom` for client-side navigation.
- **Styling**: Tailwind CSS, completely customized with a bespoke "Precision Foundry" dark HMI theme.
- **State Management**: Zustand for global state (Auth, Scanner, Shift, Toast).
- **Animations**: Framer Motion for smooth page transitions and interactive feedback.
- **Icons**: Lucide React.
- **API Communication**: Axios with automatic JWT token injection and 401 interception for auto-logout on expiry.

### 2. Backend (FastAPI + Python)
- **Framework**: FastAPI (Python 3.10+).
- **Database**: SQLite (via SQLAlchemy ORM) for lightweight, embedded relational data storage.
- **Authentication**: OAuth2 with Password Flow and JWT (JSON Web Tokens) using `passlib` and `jose`.
- **OCR Engine**: PaddleOCR / EasyOCR (with OpenCV for image preprocessing, unwarping circular text regions, etc.).
- **Concurrency**: Asynchronous endpoints to handle file uploads and database operations concurrently.
- **CORS**: Configured to accept requests from the frontend development server and production builds.

## Directory Structure

```text
e:/jsw project/main scan complete/
├── backend/                  # FastAPI Application
│   ├── app/                  # Application Source
│   │   ├── api/              # Route handlers (auth, records, scan)
│   │   ├── core/             # Configuration, Security, Auth logic
│   │   ├── db/               # SQLAlchemy models and database session
│   │   ├── services/         # OCR pipeline and business logic
│   │   └── main.py           # FastAPI entrypoint
│   ├── requirements.txt      # Python dependencies
│   └── venv/                 # Virtual Environment
│
└── frontend/                 # React + Vite Application
    ├── public/               # Static assets
    ├── src/                  # Frontend Source
    │   ├── api/              # Axios instances and API wrappers
    │   ├── components/       # Reusable UI components
    │   ├── hooks/            # Custom React hooks
    │   ├── layouts/          # Page layouts (e.g., MainLayout with sidebar)
    │   ├── pages/            # Page components (Login, Scanner, Records, Admin, etc.)
    │   ├── store/            # Zustand state stores
    │   ├── index.css         # Global styles and Tailwind utilities
    │   └── main.jsx          # React entrypoint
    ├── tailwind.config.js    # Tailwind configuration (Precision Foundry theme)
    ├── package.json          # Node dependencies
    └── vite.config.js        # Vite configuration
```

## Design System: Precision Foundry (HMI Dark Theme)

The UI has been migrated to a high-contrast, dark-mode-first industrial HMI design system. This ensures readability in harsh factory environments.

### Color Palette (`tailwind.config.js`)
- **Backgrounds**: `industrial-900` (`#1A1C1E`) and `industrial-950` (`#0F1113`) for deep, glare-reducing backgrounds.
- **Text/Borders**: `industrial-100` through `industrial-800` for neutral grays with subtle blue/teal undertones.
- **Primary/Action**: `scan-cyan` (`#00E5FF`) - Used for primary actions, active states, and focus rings. High visibility.
- **Alerts/Destructive**: `alert-red` (`#FF3366`) - Used for errors, deletions, and critical warnings.
- **Success/Live**: `signal-green` (`#00E676`) - Used for live indicators and successful scans.
- **Warnings/Processing**: `molten-amber` (`#FF6D00`) - Used for processing states and manual overrides.

### Core Utilities (`index.css`)
- `.glass-card`: Semi-transparent dark cards with subtle borders and backdrop blur.
- `.btn-primary`: Bright cyan buttons with dark text, bold font, and hover glow effects.
- `.btn-ghost`: Transparent buttons with cyan borders and text, turning solid on hover.
- `.scanline-overlay`: A subtle horizontal scanline effect applied to page backgrounds to reinforce the industrial aesthetic.

## API Endpoints

### Authentication (`/auth`)
- `POST /auth/token`: Login to obtain JWT access token.
- `GET /auth/me`: Get current user details.
- `GET /auth/users`: List all users (Admin only).
- `POST /auth/users`: Create a new user (Admin only).
- `PUT /auth/users/{user_id}/role`: Update a user's role (Admin only).
- `DELETE /auth/users/{user_id}`: Delete a user (Admin only).
- `PUT /auth/change-password`: Change the current user's password.

### Scanning (`/scan`)
- `POST /scan`: Upload an image to the OCR pipeline. Returns detected code, confidence, and latency.

### Records (`/records`)
- `GET /records`: Fetch all records with optional filters (shift, method, date, search).
- `POST /records`: Save a new record (from OCR or manual entry).
- `DELETE /records/{record_id}`: Delete a specific record (Admin or Record Creator).
- `POST /records/upload-csv`: Upload a CSV of historical records (Admin only).
- `DELETE /records/test-data`: Bulk delete all records (Admin only).
- `GET /records/export`: Export records to CSV.

## Getting Started

### Backend Setup
1. Navigate to `backend/`.
2. Activate virtual environment: `.\venv\Scripts\activate`.
3. Install dependencies: `pip install -r requirements.txt`.
4. Run server: `python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.

### Frontend Setup
1. Navigate to `frontend/`.
2. Install dependencies: `npm install`.
3. Run development server: `npm run dev`.

The frontend is configured to run on port 3001 and expects the backend API on port 8000. These can be adjusted in `vite.config.js` and `.env` respectively.
