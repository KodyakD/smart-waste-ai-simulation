# Smart Waste AI Simulation

A **software-only simulation** of an intelligent waste-monitoring platform. No physical ESP32, ultrasonic sensor, camera module, or other hardware is required.

The first version includes:

- A React + TypeScript dashboard.
- A FastAPI backend with SQLite persistence.
- Three virtual garbage bins with simulated ultrasonic distance readings.
- A visual bin/sensor/controller simulator with start, pause, reset, and manual fill controls.
- A YOLO object-detection integration for five target class names, with dataset support reported separately.
- A dataset manifest, licensed-source mapping, dataset builder and training scaffold.

> **AI honesty note:** the documented redistributable detection dataset currently covers three classes: `ordinary_waste`, `battery` and `electronic_waste`. `aerosol` and `medical_sharp` remain unsupported because no licensed annotated source is available for them. No trained weights are currently included, so `/api/v1/ai/status` reports whether a real model is configured. Unsupported class labels are flagged for manual review; the app never fabricates predictions.

## Architecture

```text
React / TypeScript (browser)
   |                          |
   | simulation controls      | image upload / camera capture
   v                          v
FastAPI backend (laptop)  ---> YOLO inference (optional model weights)
   |
   +---- Python virtual sensor simulator
   |
   +---- SQLite database + local image storage
```

The simulated sensor uses a virtual empty-distance and full-threshold calibration. It generates distance readings from the selected bin's fill percentage and sends them through the same API that a future real device could use.

## Requirements

- Python 3.10+ (3.11 recommended)
- Node.js 20+ and npm
- A modern browser
- Optional: a webcam for live image capture
- Optional for real AI inference: the packages in `backend/requirements-ai.txt`, a labeled YOLO dataset, and trained weights

## Run locally

Open two terminals from the project root.

### 1. Backend

**Windows PowerShell:**

```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Optional: copy .env.example to .env and adjust settings
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**macOS / Linux:**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# Optional: copy .env.example to .env and adjust settings
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://127.0.0.1:8000` and interactive API docs at `http://127.0.0.1:8000/docs`.

### 2. Frontend

In a second terminal, from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the URL shown by Vite (usually `http://localhost:5173`).

The frontend uses `VITE_API_URL` from `frontend/.env` if provided; by default it uses `http://localhost:8000/api/v1`.

### Open it from a phone on the same Wi-Fi

1. Keep the backend running with `--host 0.0.0.0`.
2. Find your laptop's local IPv4 address (for example `192.168.1.20`).
3. Create `frontend/.env` from `.env.example` and set:

   ```env
   VITE_API_URL=http://192.168.1.20:8000/api/v1
   ```

4. Start Vite with `npm run dev -- --host 0.0.0.0`.
5. In `backend/.env`, add `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173` (private-LAN Vite origins are also allowed by the local-development CORS rule). Open `http://192.168.1.20:5173` on your phone. Allow the browser camera permission if you use live capture. Camera access generally requires HTTPS or localhost; image upload always works over the local network.

Only use this local-network setup on a trusted network. The initial prototype is not hardened for public internet access.

## Using the IoT simulator

1. Open **IoT Simulator** in the left navigation.
2. Select one of the virtual bins.
3. Press **Start simulation** to generate readings automatically.
4. Use the level slider and **Apply level** to set a specific fill percentage.
5. Press **Pause** or **Empty bin** to control the virtual bin.

The backend stores readings in SQLite. Each virtual bin stores its own empty-distance calibration in `capacity_cm` (default: 100 cm). The full-distance calibration and simulation thresholds come from the backend environment:

```text
distance_cm = capacity_cm - (fill_percentage / 100) * (capacity_cm - SENSOR_FULL_DISTANCE_CM)
```

Copy `backend/.env.example` to `backend/.env` to configure the simulation. The live values are exposed by `GET /api/v1/config`; the frontend reads that endpoint rather than duplicating thresholds, timing, sensor calibration or AI class names. These are software simulation parameters, not physical measurements.

Use the **Bins** page to create, edit or delete virtual bins. Capacity changes recalculate the current distance, and deleting a bin removes its sensor readings while preserving its alert history.

## AI model setup

The dataset is built from public sources (see `backend/ai/datasets.md` for
licenses and limits). The redistributable CC BY 4.0 detection source currently
covers three target classes: `ordinary_waste`, `battery` and `electronic_waste`.
`aerosol` and `medical_sharp` remain unsupported because there is no usable
licensed annotated source for them. Read `backend/ai/datasets.md` and
`backend/ai/sources.json` before building or training.

1. Install the optional dependencies (the CUDA build of PyTorch is needed for
   GPU training):

   ```powershell
   cd backend
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
   pip install -r requirements-ai.txt
   cd ..
   ```

2. Build the prepared dataset (this downloads only sources marked
   redistributable and writes image files into gitignored folders):

   ```powershell
   cd backend\ai
   ..\.venv\Scripts\python.exe build_dataset.py --all
   ```

   Confirm the split counts and class histogram match `backend/ai/datasets.md`;
   you can re-run validation without downloading:

   ```powershell
   ..\.venv\Scripts\python.exe build_dataset.py --check
   ```

   An empty `aerosol` or `medical_sharp` histogram is expected for the current
   licensed sources. Do not claim those classes are trainable.

3. Validate and train, from `backend/`:

   ```powershell
   python ai/train.py check                 # per-class box counts, warns about empty classes
   python ai/train.py train --epochs 80     # yolo11n on GPU 0, copies best.pt when done
   python ai/train.py eval                  # test split -> backend/ai/report.md
   ```

   The configured target order in `backend/ai/dataset.yaml` remains five
   classes for API compatibility, but the current dataset only supplies
   training boxes for the first three. The app reports that distinction and
   sends any unsupported-class output to manual review.

4. Restart FastAPI. `/api/v1/ai/status` will report whether real weights are
   loaded and list supported and unsupported classes separately. `train.py`
   copies the winning run's `best.pt` to `backend/ai/weights/best.pt`; if you
   trained elsewhere, copy it there yourself.

Dataset images, raw archives and model weights are gitignored and must not be
committed. Preserve the source attribution and license terms in
`backend/ai/datasets.md` when redistributing a prepared dataset.
 
### AI safety and limitations

- Object detection only identifies visible objects; it cannot test chemical composition, toxicity, contamination, or hidden contents.
- Risk labels are screening guidance based on detected class names, not a laboratory hazard assessment.
- Low-confidence or unknown classes should be manually reviewed.
- Do not use the prototype to make operational decisions about handling medical sharps, chemicals, or other hazardous materials.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/health` | API health |
| GET | `/api/v1/dashboard` | Dashboard totals |
| GET | `/api/v1/bins` | Virtual bins |
| GET | `/api/v1/bins/{bin_id}/readings` | Reading history |
| GET | `/api/v1/simulation/status` | Simulation status |
| POST | `/api/v1/simulation/start/{bin_id}` | Start a bin simulation |
| POST | `/api/v1/simulation/pause/{bin_id}` | Pause a bin simulation |
| POST | `/api/v1/simulation/reset/{bin_id}` | Empty/reset a bin |
| POST | `/api/v1/simulation/level/{bin_id}` | Manually set fill level |
| GET | `/api/v1/alerts` | Alert history |
| POST | `/api/v1/alerts/{alert_id}/read` | Mark an alert as read |
| GET | `/api/v1/detections` | AI detection history |
| GET | `/api/v1/ai/status` | AI model readiness |
| POST | `/api/v1/ai/detect` | Upload an image for YOLO detection |

## Project structure

```text
smart-waste-ai-simulation/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── schemas.py
│   │   └── services/
│   │       ├── simulator.py
│   │       └── ai_service.py
│   ├── ai/
│   │   ├── dataset.yaml
│   │   ├── train.py
│   │   ├── README.md
│   │   ├── datasets/waste/{images,labels}/{train,val,test}/
│   │   └── weights/
│   ├── data/
│   ├── storage/uploads/
│   ├── requirements.txt
│   └── requirements-ai.txt
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── api.ts
    │   ├── types.ts
    │   └── styles.css
    ├── package.json
    └── vite.config.ts
```

## Current scope

This is the initial software-simulation milestone. It deliberately does not yet include production authentication, multi-tenant access control, live city maps, or a trained AI model. Those should be added after the core simulation and API are verified.
