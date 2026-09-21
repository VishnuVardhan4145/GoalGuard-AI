const API_BASE = 'http://localhost:8000';
const APP_URL = 'http://localhost:5173';

document.addEventListener('DOMContentLoaded', async () => {
  const statusIndicator = document.getElementById('backend-status');
  const goalEl = document.getElementById('active-goal-text');
  const miniNeedle = document.getElementById('mini-needle');
  const statusBadge = document.getElementById('status-badge');
  const tabTitle = document.getElementById('current-tab-title');
  const reasonEl = document.getElementById('current-reason');
  const nudgeBox = document.getElementById('nudge-box');
  const nudgeText = document.getElementById('nudge-text');
  const openAppBtn = document.getElementById('open-web-app-btn');

  // Check backend health
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      const data = await res.json();
      statusIndicator.textContent = data.mock ? 'Mock Mode' : 'Online';
      statusIndicator.classList.add('online');
    } else {
      statusIndicator.textContent = 'Offline';
    }
  } catch {
    statusIndicator.textContent = 'Offline';
  }

  // Read stored session & classification state
  chrome.storage.local.get(['sessionActive', 'currentGoal', 'latestClassification'], (data) => {
    if (data.sessionActive && data.currentGoal) {
      goalEl.textContent = data.currentGoal;
    } else {
      goalEl.textContent = 'No session active';
    }

    if (data.latestClassification) {
      const c = data.latestClassification;
      tabTitle.textContent = c.activity || 'Active Tab';
      reasonEl.textContent = c.reason || '';

      let angle = 0;
      let badgeClass = 'on_track';
      let badgeText = 'ON-TRACK';

      if (c.status === 'adjacent') {
        angle = 45;
        badgeClass = 'adjacent';
        badgeText = 'ADJACENT';
      } else if (c.status === 'drifted') {
        angle = 110;
        badgeClass = 'drifted';
        badgeText = 'DRIFT';

        if (c.nudge) {
          nudgeBox.classList.remove('hidden');
          nudgeText.textContent = c.nudge;
        }
      }

      miniNeedle.style.transform = `rotate(${angle}deg)`;
      statusBadge.className = `status-badge ${badgeClass}`;
      statusBadge.textContent = badgeText;
    }
  });

  // Open web application
  openAppBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: APP_URL });
  });
});
