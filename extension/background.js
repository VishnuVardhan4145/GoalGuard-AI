const API_BASE = 'http://localhost:8000';

// Set up recurring alarm every 30 seconds
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('goalguard_poll_alarm', { periodInMinutes: 0.5 });
  console.log('GoalGuard AI background worker installed and alarm scheduled.');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'goalguard_poll_alarm') {
    checkActiveTabAlignment();
  }
});

// Also check when tab changes or is updated
chrome.tabs.onActivated.addListener(() => {
  checkActiveTabAlignment();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    checkActiveTabAlignment();
  }
});

async function checkActiveTabAlignment() {
  try {
    const data = await chrome.storage.local.get(['sessionActive', 'currentGoal']);
    if (!data.sessionActive || !data.currentGoal) {
      return; // No active session in progress
    }

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.url || activeTab.url.startsWith('chrome://')) {
      return;
    }

    const activityDescription = `${activeTab.title || 'Unknown Tab'} (${new URL(activeTab.url).hostname})`;

    const response = await fetch(`${API_BASE}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: data.currentGoal,
        activity: activityDescription
      })
    });

    if (!response.ok) return;
    const result = await response.json();

    // Save latest status in storage for popup
    await chrome.storage.local.set({
      latestClassification: {
        status: result.status,
        confidence: result.confidence,
        reason: result.reason,
        nudge: result.nudge,
        activity: activityDescription,
        timestamp: Date.now()
      }
    });

    // Update extension badge
    if (result.status === 'drifted') {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } else if (result.status === 'adjacent') {
      chrome.action.setBadgeText({ text: '~' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    } else {
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    }
  } catch (err) {
    console.debug('Background check skipped or backend unreachable:', err);
  }
}
