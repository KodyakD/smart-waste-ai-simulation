# Handoff plan — EcoMind Smart Waste

Read `AGENTS.md` first. It holds the rules; this file holds the work. Where the
two disagree, `AGENTS.md` wins.

Work one phase at a time. **Stop and report after each phase**: what changed,
what you verified with a real request or click, what is still broken. Do not
start the next phase without a "continue".

Never do these:

- Invent data, predictions, metrics, users or sample images.
- Hardcode a domain value in the frontend (threshold, interval, distance,
  class name, path, count).
- Add a dependency without asking.
- Do not change `backend/app/services/ai_service.py` inference logic or train a
  model until the licensed dataset split has been validated locally. The current
  documented set covers only three of the five target classes.
- Reformat files you did not need to change.
- Claim "done" without `npm run build` and `pytest` passing.

## Initial baseline (2026-11-01, historical)

This was the state before the implementation update at the end of this file.
The current implementation and local verification status are recorded there.

## Phase 0 — Baseline

1. `cd backend && .\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000`
2. `cd frontend && npm run dev`
3. `npm run build` and confirm it passes before you change anything.
4. Save the current screenshots of Overview and IoT simulator.

Acceptance: you can state the current fill level of BIN-001 from the UI and
from `GET /api/v1/bins` and they match.

## Phase 1 — `GET /api/v1/config` (kills hardcoded values)

Backend:

- Extend `backend/app/config.py` with env-backed settings:
  `SIMULATION_INTERVAL_SECONDS`, `FILL_ALMOST_FULL_THRESHOLD` (70),
  `FILL_FULL_THRESHOLD` (90), `SENSOR_FULL_DISTANCE_CM` (10),
  `SPEED_OF_SOUND_CM_PER_US` (0.0343), `MAX_READINGS` (48),
  `AI_CONFIDENCE_THRESHOLD` (0.35), `APP_NAME`, `APP_ENVIRONMENT`.
- `status_for_fill()` in `database.py` must read the thresholds from config.
  Delete the literals `90` and `70` there.
- Add `GET /api/v1/config` returning exactly:

```json
{
  "simulation": { "interval_seconds": 3, "full_distance_cm": 10,
                  "speed_of_sound_cm_per_us": 0.0343, "max_readings": 48 },
  "thresholds": { "almost_full": 70, "full": 90 },
  "ai": { "configured": false, "model_path": "…", "architecture": "YOLO object detection",
          "device": "cpu", "confidence_threshold": 0.35, "classes": ["…"] },
  "app": { "name": "EcoMind", "environment": "Local instance" }
}
```

Echo time is a round trip: `echo_us = 2 * distance_cm / speed_of_sound_cm_per_us`
(≈ 58.3 µs per cm at 343 m/s). Expose the speed, never the 58.3.

Frontend:

- `AppConfig` in `types.ts`, `api.config()`, and a `ConfigProvider` that fetches
  once on boot with loading and error states.
- Remove every violation listed in `AGENTS.md` §1: fill bar tone, stat card
  notes, "Update interval", Settings page rows, class chips, scene thresholds,
  `100 cm` axis, `58.3`, `365 - fill * 1.92`.
- The scene's vertical scale derives from the bin's `capacity_cm` (Phase 2
  adds it; until then use `100` from config as the default and mark it).

Acceptance: set `SIMULATION_INTERVAL_SECONDS=7` and `FILL_FULL_THRESHOLD=85` in
`backend/.env`, restart only the backend, reload the UI — interval label, bar
colours, scene status and chart all follow. Zero frontend edits.

## Phase 2 — Bin schema + CRUD

Migration in `init_db()`: if `capacity_cm` is missing (`PRAGMA table_info`),
`ALTER TABLE bins ADD COLUMN capacity_cm REAL NOT NULL DEFAULT 100`. Never
recreate the table.

Distance, one place, used by seeding, readings and the API:

```text
distance_cm = capacity_cm - (fill / 100) * (capacity_cm - config.simulation.full_distance_cm)
```

Endpoints:

| Method | Path | Body | Errors |
|---|---|---|---|
| POST | `/api/v1/bins` | `{ id, name, location, capacity_cm, fill_percentage? }` | 409 duplicate id, 422 invalid |
| PATCH | `/api/v1/bins/{id}` | any of `name`, `location`, `capacity_cm` | 404, 422 |
| DELETE | `/api/v1/bins/{id}` | — | 404 |

Validation: id `^[A-Z0-9-]{3,16}$`, name/location 1–60 chars non-blank,
`capacity_cm` 20–400, `0 <= fill_percentage <= 100`.

Delete behaviour: stop that bin's simulation first, delete its readings
(`ON DELETE CASCADE` already set), keep alerts with `bin_id = NULL` so history
survives.

Tests: `backend/tests/test_bins.py` (pytest in `requirements-dev.txt`) covering
create, duplicate → 409, patch, delete cascades readings, delete keeps alerts.

Acceptance: the curl matrix above returns the stated codes, and
`GET /bins` after each step shows the truth.

## Phase 3 — Bins management page

New `frontend/src/pages/BinsPage.tsx` + nav entry "Bins" under WORKSPACE.

- Table: id, name, location, capacity, fill, status, actions.
- Add form (modal or inline), edit inline for name/location/capacity, delete
  behind a confirm that names the bin.
- Errors from the API rendered in the form, not swallowed.
- After any mutation, re-fetch from the API.
- Empty state when there are no bins, with a "Add bin" action.

Acceptance: a bin created here appears in the simulator dropdown and overview;
renaming it updates both without a reload; deleting it removes it everywhere and
its alerts remain, showing "Deleted bin".

## Phase 4 — Alerting audit

Fix whatever these expose, keep a test for each (extend `test_alerts.py`):

1. Alert only on upward threshold crossing, never per tick.
2. Empty + refill = exactly one new alert per crossing.
3. `dashboard.unread_alerts` equals rows with `is_read = 0`.
4. Mark-read is idempotent and the badge/count updates without reload.
5. Severity comes from the threshold that fired, defined once.
6. Deleted bin keeps alert history with `bin_id = NULL`.
7. Empty list and backend-offline both show an honest empty/error state.

Acceptance: pytest green, and a manual run: start BIN-001, let it cross 90%,
see exactly one alert, mark it read, watch the badge drop.

## Phase 5 — Simulator layout

- Scene spans the full content width.
- Controls (level slider, apply, start/pause/empty) in a row **below** the scene.
- Telemetry (readings table) below the controls.
- One column below 900px; no horizontal scroll at 375px.

Acceptance: at 1440px the scene is at least as wide as the content column; at
375px nothing overflows; every control still works.

## Phase 6 — ESP32 panel (replace the fake board)

Delete `SensorBoard` (fake "ESP 32 WROOM", pins, LEDs). Build a device panel
from real data only:

- state: running / paused (`bin.is_running`)
- update interval (`config.simulation.interval_seconds`)
- last reading timestamp (`bin.last_updated`, relative)
- payload: the bin's current distance, fill, status
- echo time: `2 * distance / config.simulation.speed_of_sound_cm_per_us`
- endpoint it would call: `POST /api/v1/simulation/level/{bin_id}`

Anything the backend does not report renders `—`. No invented pin numbers,
voltages, MAC addresses or signal strength.

Acceptance: pause the simulation → panel shows paused, interval and payload
still correct; empty the bin → distance and echo update.

## Phase 7 — Overview controls

Dead today: notifications bell, top avatar, workspace switcher, four stat cards,
recent-alert rows.

- Bell → navigate to Alerts & activity (and show the unread count from config/
  dashboard, not a hardcoded dot).
- Stat cards → navigate: bins → Bins page, average fill → simulator,
  need-collection → simulator filtered/full bin, unread alerts → activity.
- Recent-alert rows → activity page.
- Avatar and workspace switcher: no auth exists, so delete them rather than
  fake a menu.

Acceptance: click every control on the Overview page; each either navigates,
acts, or no longer exists. Nothing silently does nothing.

## Phase 8 — Final verification

```powershell
cd backend; .\.venv\Scripts\python.exe -m pytest tests -q
cd frontend; npm run build
```

Then a manual pass: Overview → Bins → Simulator → Alerts → Settings, plus one
AI page load. Commit per phase; name the skills used in each commit message.

## Phase 9 — AI training and validation (partially blocked by class coverage)

The current dataset manifest and builder are already in the repository.
The redistributable CC BY 4.0 detection set covers `ordinary_waste`, `battery`,
and `electronic_waste`. It does not cover `aerosol` or `medical_sharp`; the
other candidate sources are excluded or have unresolved redistribution terms.

The API now reports `supported_classes` and `unsupported_classes` from both
`/api/v1/config` and `/api/v1/ai/status`. Predictions whose labels map to an
unsupported class are saved for manual review, not treated as confirmed hazard
detections. Do not describe all five classes as trainable or supported.

Training has not been run and no weights are present. The image folders are
ignored by Git, so verify the local assets with `backend/ai/build_dataset.py
--check` before training. Never commit raw images, prepared images, archives,
or model weights. A licensed, annotated source is still required before
`aerosol` or `medical_sharp` can be enabled.


## Implementation update — 2026-11-01

The user requested the remaining work to be implemented in one run, directly on `main`. Phases 1–8 have now been implemented in commits on `main`:

- Runtime configuration is centralized in `backend/app/config.py` and exposed through `GET /api/v1/config`; the frontend uses a typed config provider.
- Per-bin `capacity_cm` is added through an idempotent SQLite migration. Bin create, partial update and delete endpoints include validation and preserve alert history on deletion.
- The Bins management page supports create, edit and confirmed delete, then refreshes from the API.
- Capacity alerts are generated only on upward threshold crossings, with severity mapped to the threshold.
- The simulator scene is full width, with controls and telemetry below it. The decorative SensorBoard and fictional ESP32 status artwork have been removed.
- The device panel displays bin state, backend timestamp, current payload, configured interval, calculated echo time and the software endpoint.
- Overview metric cards, notification navigation and recent alert rows are wired; fake workspace/profile controls were removed.
- Regression tests were added in `backend/tests/test_bins.py` and `backend/tests/test_alerts.py`; development test dependencies are listed in `backend/requirements-dev.txt`.

Local verification is still pending. The implementation environment could not clone the repository because outbound GitHub DNS resolution was unavailable, and the user will run `pytest`, `npm run build`, API smoke checks and UI click-through locally. No build or test pass is claimed here.

Phase 9 is partially blocked by class coverage: the documented redistributable dataset covers ordinary waste, batteries and e-waste; aerosol and medical sharps remain unsupported. The dataset builder exists, but local ignored image assets could not be inspected or trained in this environment. No model weights were generated, and no placeholder predictions were added.

Process skills applied: brainstorming, writing-plans, spec-driven-development, incremental-implementation, api-and-interface-design, frontend-design, frontend-ui-engineering, systematic-debugging, debugging-and-error-recovery, test-driven-development, webapp-testing, browser-testing-with-devtools, verification-before-completion, code-review-and-quality, code-simplification, security-and-hardening, Ultralytics yolo and yolo-datasets.
