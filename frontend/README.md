# STEELSCAN — Industrial OCR Scanner Frontend

A production-ready React frontend for the industrial coil code OCR system used in steel plants.

## Tech Stack

- **React 18** + **Vite 5**
- **Tailwind CSS** — dark industrial theme
- **Framer Motion** — smooth transitions
- **Zustand** — global state management
- **Axios** — HTTP client with offline detection
- **React Router DOM** — client-side routing
- **react-webcam** — live camera capture
- **Lucide React** — icons

## Project Structure

```
src/
├── api/
│   └── scannerApi.js          # Axios service layer
├── components/
│   ├── scanner/
│   │   ├── LiveCamera.jsx     # Webcam + capture + upload
│   │   ├── ProcessingView.jsx # OCR in progress animation
│   │   ├── ReviewPanel.jsx    # Result display + actions
│   │   └── ScannerOverlay.jsx # Industrial corner frame + beam
│   ├── records/
│   │   ├── RecordsTable.jsx   # Searchable paginated table
│   │   └── RecordDetailsModal.jsx
│   └── ui/
│       ├── ConfidenceBadge.jsx
│       ├── LoadingSpinner.jsx
│       ├── Modal.jsx
│       ├── OfflineBanner.jsx
│       └── Toaster.jsx
├── hooks/
│   ├── useBackendStatus.js    # Polls /records every 10s
│   ├── useKeyboardShortcuts.js
│   └── useScanActions.js      # Core scan workflow
├── layouts/
│   └── MainLayout.jsx         # Sidebar + outlet
├── pages/
│   ├── ScannerPage.jsx        # Dashboard
│   └── RecordsPage.jsx        # History
├── routes/
│   └── AppRoutes.jsx
├── store/
│   ├── scannerStore.js        # Zustand scan state
│   ├── recordsStore.js        # Zustand records state
│   └── toastStore.js          # Zustand notifications
└── utils/
    └── format.js
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env if your backend is not at http://127.0.0.1:8000
```

### 3. Start development server

```bash
npm run dev
# Opens at http://localhost:3000
```

### 4. Build for production

```bash
npm run build
npm run preview
```

## Backend API

The frontend expects a FastAPI backend at `http://127.0.0.1:8000` with:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/scan` | Upload image (`multipart/form-data`, field: `file`) |
| `GET` | `/records` | Fetch all scan records |
| `DELETE` | `/records/{id}` | Delete a record |

### Expected `/scan` response

```json
{
  "ocr_text": "HR3C-2024-00142",
  "confidence": 0.967,
  "processed_image": "data:image/jpeg;base64,...",
  "timestamp": "2024-03-15T14:32:01.123Z"
}
```

### Expected `/records` response

```json
[
  {
    "id": 1,
    "ocr_text": "HR3C-2024-00142",
    "confidence": 0.967,
    "image": "data:image/jpeg;base64,...",
    "processed_image": "data:image/jpeg;base64,...",
    "timestamp": "2024-03-15T14:32:01.123Z"
  }
]
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Capture (live) / Save & Continue (review) |
| `R` | Retry scan |
| `Esc` | Back to camera |

## Scanner Workflow

```
LIVE PREVIEW → [Capture / Upload] → PROCESSING → REVIEW → [Save & Continue] → LIVE PREVIEW
                                                         ↗ [Retry] ──────────────────────↗
                                                         ↗ [Back]  ──────────────────────↗
```
