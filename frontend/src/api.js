// API base: set VITE_API_BASE in production (e.g. https://your-backend.onrender.com)
// In dev, falls back to '/api' which Vite proxies to http://127.0.0.1:8000
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const HEALTH_RETRY_DELAY_MS = 5000;
const HEALTH_MAX_RETRIES = 12; // up to ~1 minute

export async function checkHealth({ onWakingUp } = {}) {
  let attempts = 0;
  while (attempts < HEALTH_MAX_RETRIES) {
    try {
      const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
      if (res.ok) return await res.json();
    } catch (_) {
      // network error — server may be sleeping
    }
    attempts++;
    if (attempts === 1 && typeof onWakingUp === 'function') {
      onWakingUp(); // notify UI after first failed attempt
    }
    if (attempts < HEALTH_MAX_RETRIES) {
      await new Promise(r => setTimeout(r, HEALTH_RETRY_DELAY_MS));
    }
  }
  // Exhausted retries — fall back gracefully to mock mode
  console.warn('Backend unreachable after retries, defaulting to mock mode.');
  return { ok: false, mock: true };
}


export async function fetchIntent(goalText, durationMin = 45) {
  const res = await fetch(`${API_BASE}/intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal_text: goalText, duration_min: Number(durationMin) })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to generate intent (${res.status})`);
  }
  return await res.json();
}

export async function classifyActivity({
  goal,
  activity,
  onTrackExamples = [],
  adjacentExamples = [],
  driftExamples = [],
  recentActivities = []
}) {
  const res = await fetch(`${API_BASE}/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal,
      activity,
      on_track_examples: onTrackExamples,
      adjacent_examples: adjacentExamples,
      drift_examples: driftExamples,
      recent_activities: recentActivities
    })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to classify activity (${res.status})`);
  }
  return await res.json();
}

export async function fetchSummary({
  goal,
  durationMin,
  logs = [],
  sessionStartTimestamp,
  sessionEndTimestamp
}) {
  const res = await fetch(`${API_BASE}/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal,
      duration_min: Number(durationMin),
      logs,
      session_start_timestamp: sessionStartTimestamp,
      session_end_timestamp: sessionEndTimestamp
    })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch summary (${res.status})`);
  }
  return await res.json();
}

export { API_BASE };
