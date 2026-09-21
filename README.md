# GoalGuard AI

> **Stay focused on what matters, not just what you're doing.**

GoalGuard AI is an intent-aware productivity assistant. You state a goal in plain language, such as "Finish my DBMS assignment, 90 min". While you work, you log what you are doing. An LLM judges whether each activity matches the **meaning** of your goal, not an app or website blocklist, and gently nudges you back when you drift.

The same activity can be on track for one goal and a distraction for another:

| Activity | Goal | Verdict |
|---|---|---|
| YouTube: Top 10 IPL moments | Learn Python for my exam | Drifted |
| YouTube: Top 10 IPL moments | Write a blog post on IPL cricket | On track |

**Live app:** YOUR-VERCEL-LINK
**Backend health check:** YOUR-RENDER-LINK/health

## Features

- **Goal setup:** free-text goal, duration presets (25 / 45 / 90 / custom), check-in interval (1 min demo, 5, 10). The AI shows what it understood as on-track, adjacent and drift examples that you can edit.
- **Active session:** sticky countdown that survives a page refresh, a compass-style status indicator, quick-tap suggestion chips, periodic check-in prompts, and a live timeline.
- **Three verdicts:** `on_track` (advances the goal), `adjacent` (related or supportive), `drifted` (unrelated). Each comes with a confidence score and a short reason.
- **Kind nudges:** on drift, a banner with vibration where the device supports it. Buttons are "Back on track" and "I meant to do this".
- **Session summary:** focus score (0-100), time split, drift timeline, context switch tax, and an AI insight sentence.
- **History:** past sessions are saved in the browser (localStorage).
- **Demo session:** one button loads a scripted 7-step Python exam session with a simulated clock.
- **PWA:** installable on a phone when served over HTTPS.
- **Mock mode:** with no API key, an offline keyword-overlap classifier keeps the whole app working. The UI shows a "Mock mode" badge.
- **Chrome extension (optional):** reads the active tab title and URL every 30 seconds and shows drift status in the popup.

## How the scoring works

- **Focus score** is a time-weighted average: on_track = 1.0, adjacent = 0.5, drifted = 0. Each log entry lasts until the next one, and the last lasts until the session ends.
- **Context switch:** any move between `on_track` and a non-`on_track` status, in either direction. Moves between adjacent and drifted do not count.
- **Context switch tax:** `switch_count x 10 to 25 minutes`, shown as a low-high range. It is an estimate based on research into how long it takes to regain deep focus after an interruption, not a measurement. The constants live in `backend/config.py`.

## Architecture

```
frontend/   React + Vite PWA (vanilla CSS), sessions stored in localStorage
backend/    FastAPI, stateless, no database
  main.py             routes and CORS
  models.py           Pydantic request/response schemas
  config.py           settings and context switch tax constants
  llm.py              Gemini provider (google-genai), retry once, then fallback
  prompts.py          system prompts
  mock_classifier.py  offline heuristic classifier
  tests/              unit tests and classifier evaluation
extension/  Manifest V3 Chrome extension (optional)
```

The API key lives only on the backend. The frontend never sees it.

### API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `{ ok, mock }` |
| POST | `/intent` | Turn a goal into on-track, adjacent and drift examples |
| POST | `/classify` | Judge one activity: `status`, `confidence`, `reason`, `nudge`, `fallback` |
| POST | `/summary` | Focus score, time split, switch count, tax range, insight |

If the model returns invalid output, the backend retries once and then falls back to the mock classifier with `"fallback": true`.

## Run locally (Windows)

Requirements: Python 3.10+, Node.js 18+, Git.

**1. Backend**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Open http://localhost:8000/health. You should see `{"ok":true,...}`.

**2. Frontend** (in a second terminal)

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

If PowerShell blocks the activation script, run `Set-ExecutionPolicy -Scope Process Bypass` first. The repo also includes `start-app.bat` for starting the app in one step.

## Get a Gemini API key

1. Go to https://aistudio.google.com and sign in.
2. Click **Get API key** and create a key.
3. Open `backend/.env` and set:

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-flash-latest
```

4. Restart the backend. `/health` should now show `"mock": false`.

Leave `GEMINI_API_KEY` empty, or set `MOCK_LLM=true`, to run in Mock mode. Never commit `.env`. It is listed in `.gitignore`.

## Tests and evaluation

```powershell
cd backend
pytest
python tests/run_eval.py --mock
python tests/run_eval.py
```

- `pytest` covers switch counting, focus score math and the tax range.
- `run_eval.py` runs the goal and activity pairs in `tests/classifier_cases.json` and the separate `tests/holdout_cases.json` through the classifier, then prints accuracy and every mismatch. `--mock` uses the offline classifier. Without it, it uses the real model (needs a key).
- The held-out set is not used for tuning. Compare the two accuracies to spot overfitting.

## Open it on a phone

**Option A: same Wi-Fi.** Find your PC's IP with `ipconfig`, then open `http://<your-ip>:5173` on the phone. Allow ports 5173 and 8000 in the Windows Firewall prompt. Browsers only allow PWA install and service workers on `localhost` or HTTPS, so this is a plain HTTP preview.

**Option B: temporary HTTPS link.** With the frontend running:

```powershell
cloudflared tunnel --url http://localhost:5173
```

It prints a `https://...trycloudflare.com` link that works only while your PC and terminals are running.

**Option C: permanent deployment (recommended).** See below.

## Deploy

**Backend on Render**

- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment variables: `GEMINI_API_KEY` (optional), `GEMINI_MODEL=gemini-flash-latest`
- If the build fails on the Python version, set `PYTHON_VERSION=3.12.3`

**Frontend on Vercel**

- Root directory: `frontend`, framework preset: Vite
- Environment variable: `VITE_API_BASE` = your Render URL, with no trailing slash

The backend allows CORS from localhost and any `https://*.vercel.app` origin. Vite bakes `VITE_API_BASE` in at build time, so redeploy the frontend after changing it. The free Render tier sleeps when idle, so the first request after a break can take 30 to 60 seconds.

## Chrome extension (optional)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.
3. Start a session in the app. The extension sends the active tab's title and URL to the backend every 30 seconds and shows the drift status in its popup.

## 3-step demo script

1. **Set the goal.** Enter "Learn Python for my exam" and start a session. Point out the on-track, adjacent and drift examples the AI generated.
2. **Show the nudge.** Log "YouTube: Python loops tutorial" (on track), then "YouTube: Top 10 IPL moments". The compass swings away, the nudge appears, and the phone vibrates.
3. **Same activity, different goal.** End the session and start "Write a blog post on IPL cricket". Log the same IPL activity. It is now on track.

Short on time? Use **Load demo session** to run a scripted 7-step session and see the summary instantly.

## Known limitations

- **Self-reported activity.** The web app cannot see what you do, so it relies on your logs and check-in prompts. Time is counted from those logs.
- **No native app tracking.** Automatic tracking of other apps on Android is roadmap work using Usage Access and Accessibility APIs.
- **Mock mode is less subtle.** The offline classifier uses keyword overlap and small word lists, and it is less accurate on ambiguous cases than the LLM.
- **Local storage only.** History is stored per browser and is not synced between devices.
- **Cold starts.** The free Render backend sleeps when idle.

## License

Add a license of your choice, for example MIT.
