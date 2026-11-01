# Build rules — EcoMind Smart Waste

These rules override any other instruction. They exist because generated code
drifted into hardcoded values, decorative fake data and dead controls.

Read this file before touching the repository. Every rule below has an
acceptance check; a change is not done until the check passes.

## Skills to load (mandatory)

Do not improvise a methodology. Before each phase, open the `SKILL.md` and
follow it. If a skill conflicts with a rule in this file, this file wins.

Every skill below is installed in `skills/` — read the local file first, for
example `skills/obra__superpowers/brainstorming/SKILL.md`. The URLs are only
for refreshing with `python skills/install.py --refresh`. If a local file is
missing, run `python skills/install.py` instead of guessing.

| Phase | Skill | URL |
|---|---|---|
| Any non-trivial feature | brainstorming | https://raw.githubusercontent.com/obra/superpowers/main/skills/brainstorming/SKILL.md |
| Turning it into steps | writing-plans | https://raw.githubusercontent.com/obra/superpowers/main/skills/writing-plans/SKILL.md |
| Spec before code | spec-driven-development | https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/spec-driven-development/SKILL.md |
| Small safe steps | incremental-implementation | https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/incremental-implementation/SKILL.md |
| API + schema design | api-and-interface-design | https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/api-and-interface-design/SKILL.md |
| UI / layout / visualisation | frontend-design | https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md |
| Component structure | frontend-ui-engineering | https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/frontend-ui-engineering/SKILL.md |
| Any bug | systematic-debugging | https://raw.githubusercontent.com/obra/superpowers/main/skills/systematic-debugging/SKILL.md |
| Fixing a failure | debugging-and-error-recovery | https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/debugging-and-error-recovery/SKILL.md |
| New logic | test-driven-development | https://raw.githubusercontent.com/obra/superpowers/main/skills/test-driven-development/SKILL.md |
| Clicking through the UI | webapp-testing | https://raw.githubusercontent.com/anthropics/skills/main/skills/webapp-testing/SKILL.md |
| Browser/devtools checks | browser-testing-with-devtools | https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/browser-testing-with-devtools/SKILL.md |
| Before saying "done" | verification-before-completion | https://raw.githubusercontent.com/obra/superpowers/main/skills/verification-before-completion/SKILL.md |
| Self review | code-review-and-quality | https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/code-review-and-quality/SKILL.md |
| Removing bloat | code-simplification | https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/code-simplification/SKILL.md |
| Auth / uploads / input | security-and-hardening | https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/security-and-hardening/SKILL.md |

Source repositories (star counts and layout change; the URLs above are what
matter):

- https://github.com/obra/superpowers — process skills: brainstorm, plan,
  debug, TDD, verify.
- https://github.com/anthropics/skills — Anthropic's public Agent Skills,
  including `frontend-design` and `webapp-testing`.
- https://github.com/addyosmani/agent-skills — production engineering skills:
  spec, API design, code review, security.
- https://github.com/mattpocock/skills — optional; `engineering/tdd`,
  `engineering/diagnosing-bugs`, `engineering/code-review` if the above are
  unavailable.

Rules:

- Load the skill **before** starting the phase, not after it goes wrong.
- Name the skills you used in the commit message or PR body.
- A skill is process, not permission: it never overrides section 1 (no
  hardcoded values) or the anti-slop checklist.

### Dataset and model skills (`backend/ai/`)

The generic skills above stop at the ML boundary. For anything under
`backend/ai/`, load the official Ultralytics skills instead — they are the
stack this repo actually uses.

| Task | Skill | URL |
|---|---|---|
| Any YOLO work — routing, CLI, config | yolo | https://raw.githubusercontent.com/ultralytics/skills/main/skills/yolo/SKILL.md |
| Building, converting, splitting datasets; `data.yaml`; label formats; validate-before-train | yolo-datasets | https://raw.githubusercontent.com/ultralytics/skills/main/skills/yolo-datasets/SKILL.md |
| Training, fine-tuning, validating, reading `runs/`, troubleshooting | yolo-training | https://raw.githubusercontent.com/ultralytics/skills/main/skills/yolo-training/SKILL.md |
| Improving a trained model, hyperparameter search | yolo-tuning | https://raw.githubusercontent.com/ultralytics/skills/main/skills/yolo-tuning/SKILL.md |
| Choosing a model family or size | yolo-models | https://raw.githubusercontent.com/ultralytics/skills/main/skills/yolo-models/SKILL.md |
| Prediction and tracking | yolo-inference | https://raw.githubusercontent.com/ultralytics/skills/main/skills/yolo-inference/SKILL.md |
| ONNX / TFLite / other export | yolo-export | https://raw.githubusercontent.com/ultralytics/skills/main/skills/yolo-export/SKILL.md |
| Dataset curation: dedupe, leakage, class imbalance, dataset card | dataset-curator | https://raw.githubusercontent.com/xcrrr/claude-skills/main/skills/ai-ml/dataset-curator/SKILL.md |

Sources: https://github.com/ultralytics/skills (AGPL-3.0 — link only, never
copy into this repo) and https://github.com/xcrrr/claude-skills (MIT, low-star
community repo — read it as a checklist, not as authority).

`dataset-curator` is the only skill that talks about the failure this repo
already hit: a validation split that duplicates training images. Its advice
does not override `backend/ai/datasets.md`, which records the licenses and the
actual counts.

## Handoff prompt

Paste this with the repo when handing the work to another model:

> You are working on the EcoMind smart waste simulation: FastAPI + SQLite
> backend, React + TypeScript frontend. Follow `AGENTS.md` exactly. Load the
> skills listed in it before each phase — start with `brainstorming`, then
> `writing-plans`, and finish with `verification-before-completion`; do not
> substitute your own process for theirs. No hardcoded domain values in the
> frontend — everything comes from `GET /api/v1/config` or the bin record. No
> fake data, no decorative metrics, no dead buttons. Run `npm run build` and
> the backend tests before claiming anything is done. Implement the work order
> in section 8, in order. Ask before adding a dependency. Ask the human for
> the dataset links before touching the AI model — never invent a dataset or
> sample images.

## Shared branch protocol

`main` is shared with other agents working at the same time. Follow this or you
will overwrite someone else's work.

- Pull before you start: `git pull --rebase`.
- Push with `git pull --rebase && git push`. If the push is rejected, rebase
  and retry. **Never** `git push --force` and never rewrite published commits.
- Small commits, one concern each. A rebase conflict should be rare and small.
- Change only the files your task needs. Do not reformat, re-sort imports or
  "clean up" files you were not asked to touch — that is how parallel work gets
  clobbered.
- In a conflict, keep both intents. Never resolve with `--ours` / `--theirs` or
  `git rebase --skip` to make it go away.
- If a file you need is already being edited elsewhere (check `git log -5
  --name-only`), say so before editing it.

## 0. Definition of done

- `cd frontend && npm run build` passes (`tsc -b` is part of it — no unused
  symbols, no `any`, no `@ts-ignore`).
- The backend starts and every endpoint you touched was called once with real
  data (`curl` / `Invoke-WebRequest`), not just "it compiles".
- No new dependency without asking first.
- No placeholder data, no invented predictions, no decorative metrics. If a
  value is unknown, render `—` and say why.

## 1. Zero hardcoded domain values in the frontend

The backend is the single source of truth. The frontend may only hardcode
layout: CSS units, SVG viewBox geometry, icon sizes.

Required contract — `GET /api/v1/config`:

```json
{
  "simulation": {
    "interval_seconds": 3,
    "full_distance_cm": 10,
    "speed_of_sound_cm_per_us": 0.0343,
    "max_readings": 48
  },
  "thresholds": { "almost_full": 70, "full": 90 },
  "ai": {
    "configured": false,
    "model_path": "backend/ai/weights/best.pt",
    "architecture": "YOLO object detection",
    "device": "cpu",
    "confidence_threshold": 0.35,
    "classes": ["ordinary_waste", "battery", "electronic_waste", "aerosol", "medical_sharp"]
  },
  "app": { "name": "EcoMind", "environment": "Local instance" }
}
```

Values live in `backend/app/config.py` (env-overridable), are exposed by that
endpoint, and are mirrored in `frontend/src/types.ts` as `AppConfig`.

Per-bin physical capacity is **not** in the config endpoint — it is a column on
each bin (`bins.capacity_cm`, default `100`). Distance is derived from it:

```text
distance_cm = capacity_cm - (fill / 100) * (capacity_cm - config.simulation.full_distance_cm)
```

`capacity_cm` is the empty distance measured by the sensor, so a taller bin
reads a larger empty distance. Never hardcode `100` or `90` as a span in
either layer.

Known violations to remove — every one of these must disappear:

| File | Line | Hardcoded |
|---|---|---|
| `frontend/src/App.tsx` | 71 | fill bar thresholds `90` / `70` |
| `frontend/src/App.tsx` | 100 | `"Across 3 simulated zones"` |
| `frontend/src/App.tsx` | 102 | `"At 90% capacity or above"` |
| `frontend/src/App.tsx` | 139 | `"Update interval: 3 sec"` |
| `frontend/src/App.tsx` | Settings page | `3 seconds`, `5 waste categories`, `backend/ai/weights/best.pt`, `Local laptop`, `YOLO object detection`, `CPU / automatic` |
| `frontend/src/App.tsx` | 215 | class chips list typed in by hand instead of `config.ai.classes` |
| `frontend/src/ImmersiveBinScene.tsx` | 15, 20–21, 177, 207 | thresholds `70`/`90`, `100 cm` scale, `58.3` µs/cm, surface maths `365 - fill * 1.92` |

Acceptance: set `SIMULATION_INTERVAL_SECONDS=7` and
`FILL_FULL_THRESHOLD=85` in `backend/.env`, restart only the backend, reload
the UI — every label, bar colour, scene status and chart follows, with zero
frontend edits.

## 2. Datasets

The sources are resolved and recorded in `backend/ai/datasets.md` and
`backend/ai/sources.json`. Read both before touching anything AI-related.

| Source | License | Redistributable | Used |
|---|---|---|---|
| Synthetic outdoor waste (Mendeley `2x69gjbcz6` v2) | CC BY 4.0 | yes | core, 6,000 images |
| RecyBat24 (`10.5281/zenodo.15490523`) | CC BY-NC-ND 4.0 | no | private eval only |
| TACO (`10.5281/zenodo.3242434`) | per-image license `null` | no | excluded |
| Medical-Waste-4.0 (`10.5281/zenodo.7709001`) | other-open, no terms | unresolved | blocked |
| ETID (Mendeley `bndsgcspbx`) | CC BY 4.0 | yes | excluded, no boxes |

Hard rules:

- Never commit images or raw archives. `backend/ai/raw/` and
  `backend/ai/datasets/waste/{images,labels}/` are gitignored; keep it that way.
- Never merge a non-redistributable source into the published set. RecyBat24
  is NC-ND: a relabelled copy is a derivative and cannot be shared.
- Never claim a class the data does not cover. `aerosol` and `medical_sharp`
  have no licensed source; the API must report them as unsupported.
- Class order in `backend/ai/dataset.yaml` must equal
  `config.ai.classes`; remap with an explicit `class_map`, never by guessing.
- Any redistribution keeps the CC BY 4.0 attribution and states that classes
  were remapped 10 -> 5.

## 3. Alerting must actually work

Verify each item against a running backend, then keep a test for it:

1. An alert fires **only** when a bin crosses a threshold upward, never once
   per reading tick.
2. Emptying and refilling a bin produces exactly one new alert per crossing.
3. `unread_alerts` in `/dashboard` equals `alerts` rows with `is_read = 0`.
4. `POST /alerts/{id}/read` flips one row, is idempotent, and the badge and
   count update without a page reload.
5. Severity mapping is defined in one place and matches the threshold that
   triggered it.
6. Deleting a bin keeps its alert history with `bin_id = NULL`.
7. The UI shows an empty state, not a fake "all good" claim, when the alert
   list is empty and when the backend is offline.

One pytest file (`backend/tests/test_alerts.py`) covers 1, 2, 3 and 6.
`pytest` goes in a new `requirements-dev.txt`, not in production requirements.

## 4. Every control on the Overview page works

Dead controls found: topbar notifications bell, top avatar, workspace
switcher, the four stat cards, recent-alert rows. Working: "Open simulator",
"View simulator", nav links.

Rule: no control ships dead. Either wire it to a real destination/action or
delete it. A button that does nothing is a bug, not a placeholder.

## 5. Bin management (create / edit / delete)

Backend:

- `POST /api/v1/bins` — body `{ id, name, location, capacity_cm, fill_percentage? }`
- `PATCH /api/v1/bins/{bin_id}` — partial update of `name`, `location`, `capacity_cm`
- `DELETE /api/v1/bins/{bin_id}` — stops its simulation, deletes readings, keeps alerts with `bin_id = NULL`

Validation at the trust boundary: id matches `^[A-Z0-9-]{3,16}$` and is
unique, `name`/`location` non-empty, `capacity_cm > 0`, `0 <= fill <= 100`.
Return 409 on duplicate id, 404 on unknown id, 422 on invalid body.

Storage: add a `capacity_cm` column with an idempotent migration
(`PRAGMA table_info` + `ALTER TABLE`), never drop or recreate existing data.

Frontend: a "Bins" page with a table (id, name, location, capacity, fill,
status, actions), an add form, inline edit, and delete behind a confirm.
After any mutation, refresh from the API — do not mutate local state as truth.

## 6. Simulator layout

The visualisation owns the full content width. Controls sit **below** it in a
responsive row, telemetry below that. No narrow side column squeezing the
scene. Single column below 900px.

## 7. ESP32 panel

Delete the decorative `SensorBoard` (fake "ESP 32 WROOM", fake pins, fake
LEDs). Replace it with real telemetry: device state (running/paused), update
interval, last reading timestamp, current payload, echo time computed from
`config.simulation.speed_of_sound_cm_per_us`, and the HTTP endpoint it would
use. Anything the backend does not report is rendered `—`, never invented.

## 8. Work order

Do these in order; each step must leave the app running.

1. `GET /api/v1/config` + `frontend/src/types.ts` types + a `useConfig` hook.
   Replace every violation in section 1. Verify by changing `.env` only.
2. Bin schema migration (`capacity_cm`), per-bin distance formula, then
   `POST` / `PATCH` / `DELETE /api/v1/bins` with validation and tests.
3. Bins management page (table + add + edit + delete with confirm).
4. Alerting audit: fix what the checklist in section 3 exposes, add
   `backend/tests/test_alerts.py`.
5. Simulator layout: full-width scene, controls below, telemetry below.
6. Replace `SensorBoard` with real ESP32 telemetry (section 7).
7. Overview: wire or delete every dead control (section 4).

Do not start step 2 before step 1 lands, or the new UI inherits the same
hardcoded values.

## 9. Known traps

- `tsc -b` fails the build on unused imports (`TS6133`) and missing imports
  (`TS2552`) that Vite dev mode silently tolerates. Run the build, not just
  the dev server.
- SVG `<defs>` ids are global to the document. If two scenes render at once,
  suffix every gradient/clip/filter id with the bin id.
- SQLite needs `PRAGMA foreign_keys = ON` per connection (already in
  `connect()`); deleting a bin without it leaves orphan readings.
- `is_running` lives in the DB, not in memory. Stop the runner before
  deleting a bin, or the next tick writes to a dead row.
- The frontend polls every 3 s (`App.tsx` refresh timer). After a mutation,
  await the refresh; do not trust optimistic local state.
- Windows: git warns about LF→CRLF on commit. Ignore it, do not add
  `.gitattributes` unless asked.

## Anti-slop checklist

- No duplicated thresholds: one config source, imported everywhere.
- No `console.log`, no commented-out code, no unused exports or imports.
- Errors surface in the UI; never swallow a failure into a silent catch.
- Every fetch has loading and error states.
- Files stay under ~250 lines; split pages into `frontend/src/pages/`.
- No emoji, no invented marketing copy, no fake user names or avatars.

## Verify before you say "done"

```powershell
cd backend; .\.venv\Scripts\python.exe -m pytest tests -q
cd frontend; npm run build
```

Then open the UI and click every control on the page you changed.
