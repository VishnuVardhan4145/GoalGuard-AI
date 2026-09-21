import React, { useState, useEffect, useRef } from 'react';
import { checkHealth, fetchIntent, classifyActivity, fetchSummary } from './api';

// Pre-scripted 7-step Python exam workflow for instant demo playback
const DEMO_STEPS = [
  { activity: 'Setting up VS Code workspace and terminal', status: 'adjacent', intervalMin: 3, reason: 'Supportive workspace preparation.' },
  { activity: 'Watching Python loops and recursion tutorial', status: 'on_track', intervalMin: 12, reason: 'Directly advances Python exam preparation.' },
  { activity: 'Coding practice recursive function for factorial', status: 'on_track', intervalMin: 15, reason: 'Active implementation and practice.' },
  { activity: 'Checking Stack Overflow for IndexError fix', status: 'adjacent', intervalMin: 5, reason: 'Troubleshooting specific technical obstacle.' },
  { activity: 'Watching IPL cricket match highlights', status: 'drifted', intervalMin: 7, reason: 'Sports entertainment unrelated to Python exam.', nudge: 'Take a mindful breath. Let\'s step back from IPL highlights and refocus on your exam.' },
  { activity: 'Slack message to study group asking about recursion example', status: 'adjacent', intervalMin: 4, reason: 'Consulting study group on subject question.' },
  { activity: 'Solving final practice recursion problems in Python', status: 'on_track', intervalMin: 14, reason: 'Directly solving core exam exercises.' }
];

export default function App() {
  // Navigation: 'setup' | 'active' | 'summary' | 'history'
  const [currentTab, setCurrentTab] = useState('setup');
  
  // Health & System state
  const [systemHealth, setSystemHealth] = useState({ ok: true, mock: true });
  const [serverWakingUp, setServerWakingUp] = useState(false);

  // Setup state
  const [goalInput, setGoalInput] = useState('Learn Python for my exam in 45m');
  const [durationMin, setDurationMin] = useState(45);
  const [checkInIntervalMin, setCheckInIntervalMin] = useState(5); // 1, 5, 10
  const [isParsingIntent, setIsParsingIntent] = useState(false);
  const [cleanGoal, setCleanGoal] = useState('');
  const [onTrackExamples, setOnTrackExamples] = useState([]);
  const [adjacentExamples, setAdjacentExamples] = useState([]);
  const [driftExamples, setDriftExamples] = useState([]);
  const [newChipText, setNewChipText] = useState({ on_track: '', adjacent: '', drift: '' });

  // Active session state
  const [sessionActive, setSessionActive] = useState(false);
  const [timeRemainingSec, setTimeRemainingSec] = useState(45 * 60);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [activityInput, setActivityInput] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('on_track'); // 'on_track' | 'adjacent' | 'drifted'
  const [currentConfidence, setCurrentConfidence] = useState(1.0);
  const [currentReason, setCurrentReason] = useState('Session started. Focus on your stated goal.');
  const [currentNudge, setCurrentNudge] = useState('');
  const [logs, setLogs] = useState([]); // [{ timestamp, activity, status, reason, nudge }]
  const [shakeTrigger, setShakeTrigger] = useState(false);
  
  // Modals
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
  const [showTimeUpModal, setShowTimeUpModal] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null);
  const [selectedHistorySession, setSelectedHistorySession] = useState(null);

  // Summary state
  const [summaryData, setSummaryData] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // History stored in localStorage
  const [savedSessions, setSavedSessions] = useState(() => {
    try {
      const stored = localStorage.getItem('goalguard_sessions');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Check health on load — with waking-up retry for free-tier backends
  useEffect(() => {
    checkHealth({ onWakingUp: () => setServerWakingUp(true) })
      .then(h => {
        setServerWakingUp(false);
        setSystemHealth(h);
      });
  }, []);

  // Sync savedSessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('goalguard_sessions', JSON.stringify(savedSessions));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  }, [savedSessions]);

  // Session timer ticker
  useEffect(() => {
    if (!sessionActive) return;
    const interval = setInterval(() => {
      setTimeRemainingSec(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowTimeUpModal(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionActive]);

  // Periodic check-in prompt trigger
  useEffect(() => {
    if (!sessionActive || checkInIntervalMin <= 0) return;
    const checkInMs = checkInIntervalMin * 60 * 1000;
    const checkInTimer = setInterval(() => {
      setShowCheckInModal(true);
      // Gentle notification vibration if supported
      if ('vibrate' in navigator) navigator.vibrate([80, 40, 80]);
    }, checkInMs);
    return () => clearInterval(checkInTimer);
  }, [sessionActive, checkInIntervalMin]);

  // Auto-parse duration when goal text changes
  const handleGoalChange = (text) => {
    setGoalInput(text);
    // Simple regex check for auto-preset hint
    const minMatch = text.match(/(?:in|for|\s)(\d+)\s*(?:minutes?|mins?|m)\b/i);
    const hrMatch = text.match(/(?:in|for|\s)(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
    if (minMatch) {
      setDurationMin(parseInt(minMatch[1], 10));
    } else if (hrMatch) {
      setDurationMin(Math.round(parseFloat(hrMatch[1]) * 60));
    }
  };

  // Generate Intent & Examples
  const handleParseIntent = async () => {
    if (!goalInput.trim()) return;
    setIsParsingIntent(true);
    try {
      const data = await fetchIntent(goalInput, durationMin);
      setCleanGoal(data.goal);
      setDurationMin(data.duration_min || durationMin);
      setOnTrackExamples(data.on_track_examples || []);
      setAdjacentExamples(data.adjacent_examples || []);
      setDriftExamples(data.drift_examples || []);
    } catch (err) {
      alert(`Intent parsing notice: Operating with local offline profile (${err.message})`);
      setCleanGoal(goalInput);
      setOnTrackExamples([
        'Writing core assignment solutions',
        'Watching related chapter tutorial',
        'Practicing textbook exercises'
      ]);
      setAdjacentExamples([
        'Checking reference documentation',
        'Organizing project files',
        'Brief hydration break'
      ]);
      setDriftExamples([
        'Scrolling social media feeds',
        'Watching unrelated video clips',
        'Browsing shopping sales'
      ]);
    } finally {
      setIsParsingIntent(false);
    }
  };

  // Start Session
  const handleStartSession = () => {
    const activeGoal = cleanGoal || goalInput;
    if (!activeGoal.trim()) return;
    setCleanGoal(activeGoal);
    setTimeRemainingSec(durationMin * 60);
    setSessionStartTime(Date.now());
    setLogs([
      {
        timestamp: Date.now(),
        activity: 'Session started: ' + activeGoal,
        status: 'on_track',
        reason: 'Initial session anchor.',
        nudge: ''
      }
    ]);
    setCurrentStatus('on_track');
    setCurrentConfidence(1.0);
    setCurrentReason('Goal anchor initialized. You are on track.');
    setCurrentNudge('');
    setSessionActive(true);
    setCurrentTab('active');
  };

  // Classify an Activity Log
  const handleLogActivity = async (customText) => {
    const textToClassify = (customText || activityInput).trim();
    if (!textToClassify) return;
    setIsClassifying(true);
    setActivityInput('');
    setShowCheckInModal(false);

    try {
      const recentStrings = logs.slice(-3).map(l => `${l.activity} [${l.status}]`);
      const result = await classifyActivity({
        goal: cleanGoal || goalInput,
        activity: textToClassify,
        onTrackExamples,
        adjacentExamples,
        driftExamples,
        recentActivities: recentStrings
      });

      const newLog = {
        timestamp: Date.now(),
        activity: textToClassify,
        status: result.status,
        confidence: result.confidence,
        reason: result.reason,
        nudge: result.nudge || ''
      };

      setLogs(prev => [...prev, newLog]);
      setCurrentStatus(result.status);
      setCurrentConfidence(result.confidence);
      setCurrentReason(result.reason);
      setCurrentNudge(result.nudge || '');

      // Drift feedback (gentle shake + vibration)
      if (result.status === 'drifted') {
        setShakeTrigger(true);
        setTimeout(() => setShakeTrigger(false), 600);
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      }
    } catch (err) {
      console.error('Classification error:', err);
    } finally {
      setIsClassifying(false);
    }
  };

  // Finish / End Session and Calculate Summary
  const handleEndSession = async () => {
    setShowEndConfirmModal(false);
    setShowTimeUpModal(false);
    setSessionActive(false);
    setIsGeneratingSummary(true);
    setCurrentTab('summary');

    const endTs = Date.now();
    try {
      const summary = await fetchSummary({
        goal: cleanGoal || goalInput,
        durationMin,
        logs,
        sessionStartTimestamp: sessionStartTime,
        sessionEndTimestamp: endTs
      });

      const fullRecord = {
        id: 'sess_' + Date.now(),
        date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        goal: cleanGoal || goalInput,
        durationMin,
        ...summary,
        logs
      };

      setSummaryData(fullRecord);
      setSavedSessions(prev => [fullRecord, ...prev]);
    } catch (err) {
      console.error('Summary error:', err);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Load Demo Session Workflow
  const handleLoadDemoSession = async () => {
    const demoGoal = 'Learn Python for my exam';
    setCleanGoal(demoGoal);
    setGoalInput(demoGoal);
    setDurationMin(60);

    // Build simulated timestamps
    const now = Date.now();
    let currentOffsetMs = 0;
    const simulatedLogs = [];

    DEMO_STEPS.forEach(step => {
      simulatedLogs.push({
        timestamp: now + currentOffsetMs,
        activity: step.activity,
        status: step.status,
        reason: step.reason,
        nudge: step.nudge || ''
      });
      currentOffsetMs += step.intervalMin * 60 * 1000;
    });

    setLogs(simulatedLogs);
    setIsGeneratingSummary(true);
    setCurrentTab('summary');

    try {
      const summary = await fetchSummary({
        goal: demoGoal,
        durationMin: 60,
        logs: simulatedLogs,
        sessionStartTimestamp: now,
        sessionEndTimestamp: now + currentOffsetMs
      });

      const fullRecord = {
        id: 'sess_demo_' + Date.now(),
        date: 'Demo: Today',
        goal: demoGoal,
        durationMin: 60,
        ...summary,
        logs: simulatedLogs
      };

      setSummaryData(fullRecord);
      setSavedSessions(prev => [fullRecord, ...prev]);
    } catch (err) {
      console.error('Demo summary generation error:', err);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Calculate needle rotation angle based on current status
  const getNeedleAngle = () => {
    if (currentStatus === 'on_track') return 0;
    if (currentStatus === 'adjacent') return 48;
    return 115; // drifted
  };

  // Format seconds to MM:SS
  const formatTime = (totalSec) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Add chip helper
  const handleAddChip = (category) => {
    const val = newChipText[category]?.trim();
    if (!val) return;
    if (category === 'on_track') setOnTrackExamples(prev => [...prev, val]);
    if (category === 'adjacent') setAdjacentExamples(prev => [...prev, val]);
    if (category === 'drift') setDriftExamples(prev => [...prev, val]);
    setNewChipText(prev => ({ ...prev, [category]: '' }));
  };

  // Remove chip helper
  const handleRemoveChip = (category, index) => {
    if (category === 'on_track') setOnTrackExamples(prev => prev.filter((_, i) => i !== index));
    if (category === 'adjacent') setAdjacentExamples(prev => prev.filter((_, i) => i !== index));
    if (category === 'drift') setDriftExamples(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="app-shell">
      {/* Header & Navigation */}
      <header className="app-header">
        <div className="brand-wrapper" onClick={() => setCurrentTab('setup')}>
          <svg className="brand-icon" viewBox="0 0 64 64" fill="none">
            <path d="M32 4L10 12V28C10 44 20 54 32 60C44 54 54 44 54 28V12L32 4Z" fill="url(#brandGrad)" stroke="#38bdf8" strokeWidth="2"/>
            <circle cx="32" cy="32" r="16" fill="#0f172a" stroke="#0284c7" strokeWidth="2"/>
            <polygon points="32,20 28,32 32,30 36,32" fill="#10b981"/>
            <polygon points="32,44 28,32 32,34 36,32" fill="#ef4444"/>
            <circle cx="32" cy="32" r="3" fill="#f8fafc"/>
            <defs>
              <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8"/>
                <stop offset="100%" stopColor="#0369a1"/>
              </linearGradient>
            </defs>
          </svg>
          <div>
            <h1 className="brand-title">GoalGuard AI</h1>
            <p className="brand-subtitle">Intent-Aware Focus</p>
          </div>
        </div>

        <div className="header-right">
          <div className={`mode-badge ${!systemHealth.mock ? 'live' : ''}`}>
            <span className="pulse-dot"></span>
            {!systemHealth.mock ? 'Gemini Live' : 'Intelligent Mock'}
          </div>

          <nav className="nav-tabs">
            <button
              className={`nav-tab-btn ${currentTab === 'setup' ? 'active' : ''}`}
              onClick={() => setCurrentTab('setup')}
            >
              Setup
            </button>
            <button
              className={`nav-tab-btn ${currentTab === 'active' ? 'active' : ''}`}
              onClick={() => setCurrentTab('active')}
              disabled={!sessionActive}
            >
              Session {sessionActive && '•'}
            </button>
            <button
              className={`nav-tab-btn ${currentTab === 'summary' ? 'active' : ''}`}
              onClick={() => setCurrentTab('summary')}
              disabled={!summaryData}
            >
              Summary
            </button>
            <button
              className={`nav-tab-btn ${currentTab === 'history' ? 'active' : ''}`}
              onClick={() => setCurrentTab('history')}
            >
              History
            </button>
          </nav>
        </div>
      </header>

      {/* Server waking-up notice */}
      {serverWakingUp && (
        <div className="wakeup-banner" role="status" aria-live="polite">
          <span className="wakeup-spinner" aria-hidden="true" />
          <span>Waking up the server, this can take up to a minute…</span>
        </div>
      )}

      {/* ========================================================
          SCREEN 1: GOAL SETUP
          ======================================================== */}
      {currentTab === 'setup' && (
        <main>
          <div className="card">
            <h2 className="card-title">Define Your Focus Intent</h2>
            <p className="card-subtitle">
              Tell GoalGuard what you want to achieve. We evaluate true meaning over rigid website blocklists.
            </p>

            <div className="input-group">
              <label className="input-label" htmlFor="goal-input">Your Goal (natural language):</label>
              <input
                id="goal-input"
                className="text-input"
                type="text"
                value={goalInput}
                placeholder="e.g., Learn Python for my exam in 45m"
                onChange={(e) => handleGoalChange(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label">Planned Duration:</label>
              <div className="presets-row">
                {[25, 45, 60, 90].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    className={`preset-chip ${durationMin === mins ? 'selected' : ''}`}
                    onClick={() => setDurationMin(mins)}
                  >
                    {mins} min {mins === 25 ? '(Pomodoro)' : mins === 45 ? '(Deep Work)' : mins === 90 ? '(Flow)' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Check-in Frequency:</label>
              <div className="presets-row">
                {[1, 5, 10].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    className={`preset-chip ${checkInIntervalMin === mins ? 'selected' : ''}`}
                    onClick={() => setCheckInIntervalMin(mins)}
                  >
                    {mins} min {mins === 1 ? '(Demo Mode)' : ''}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={handleParseIntent}
                disabled={isParsingIntent || !goalInput.trim()}
              >
                {isParsingIntent ? 'Analyzing Intent...' : '✨ Parse Intent & Activities'}
              </button>

              <button
                className="btn btn-demo"
                onClick={handleLoadDemoSession}
              >
                ⚡ Load Demo Session (7-Step Python Exam)
              </button>
            </div>

            {/* Parsed Intent Visualizer */}
            {(onTrackExamples.length > 0 || cleanGoal) && (
              <div style={{ marginTop: '24px' }}>
                <div style={{ padding: '12px 16px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)', marginBottom: '16px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Targeted Session Goal: </span>
                  <strong style={{ color: '#f8fafc', fontSize: '0.95rem' }}>{cleanGoal || goalInput}</strong>
                  <span style={{ marginLeft: '12px', fontSize: '0.8rem', color: '#38bdf8' }}>({durationMin} min block)</span>
                </div>

                {/* On-Track Chips */}
                <div className="category-group on-track">
                  <div className="category-header">
                    <span className="category-title">🎯 On-Track Activities (Directly Advances Goal)</span>
                    <span style={{ fontSize: '0.78rem', color: '#34d399' }}>{onTrackExamples.length} rules</span>
                  </div>
                  <div className="chips-container">
                    {onTrackExamples.map((ex, idx) => (
                      <span key={idx} className="interactive-chip">
                        {ex}
                        <button className="chip-remove-btn" onClick={() => handleRemoveChip('on_track', idx)}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <input
                      className="text-input"
                      style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                      placeholder="Add custom on-track activity..."
                      value={newChipText.on_track}
                      onChange={e => setNewChipText(p => ({ ...p, on_track: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleAddChip('on_track')}
                    />
                    <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={() => handleAddChip('on_track')}>Add</button>
                  </div>
                </div>

                {/* Adjacent Chips */}
                <div className="category-group adjacent">
                  <div className="category-header">
                    <span className="category-title">⚡ Adjacent Activities (Supportive / Reference / Prep)</span>
                    <span style={{ fontSize: '0.78rem', color: '#fbbf24' }}>{adjacentExamples.length} rules</span>
                  </div>
                  <div className="chips-container">
                    {adjacentExamples.map((ex, idx) => (
                      <span key={idx} className="interactive-chip">
                        {ex}
                        <button className="chip-remove-btn" onClick={() => handleRemoveChip('adjacent', idx)}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <input
                      className="text-input"
                      style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                      placeholder="Add supportive activity..."
                      value={newChipText.adjacent}
                      onChange={e => setNewChipText(p => ({ ...p, adjacent: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleAddChip('adjacent')}
                    />
                    <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={() => handleAddChip('adjacent')}>Add</button>
                  </div>
                </div>

                {/* Drift Chips */}
                <div className="category-group drift">
                  <div className="category-header">
                    <span className="category-title">🛑 Drift Activities (Distractions to Nudge)</span>
                    <span style={{ fontSize: '0.78rem', color: '#f87171' }}>{driftExamples.length} rules</span>
                  </div>
                  <div className="chips-container">
                    {driftExamples.map((ex, idx) => (
                      <span key={idx} className="interactive-chip">
                        {ex}
                        <button className="chip-remove-btn" onClick={() => handleRemoveChip('drift', idx)}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <input
                      className="text-input"
                      style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                      placeholder="Add distraction to watch for..."
                      value={newChipText.drift}
                      onChange={e => setNewChipText(p => ({ ...p, drift: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleAddChip('drift')}
                    />
                    <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={() => handleAddChip('drift')}>Add</button>
                  </div>
                </div>

                <div style={{ marginTop: '24px' }}>
                  <button className="btn btn-primary" style={{ width: '100%', padding: '14px' }} onClick={handleStartSession}>
                    🚀 Start Focus Session
                  </button>
                </div>
              </div>
            )}

            {/* Interactive Explainer Card */}
            <div className="explainer-box">
              <h3 className="explainer-title">
                💡 Same Activity, Different Goal
              </h3>
              <p className="explainer-text">
                Rigid website blocklists blindly block YouTube or Reddit. GoalGuard is <strong>intent-aware</strong>.
                If your goal is <em>"Learn Python"</em>, watching <em>"IPL Cricket Highlights"</em> triggers a gentle nudge.
                However, if your goal is <em>"Write cricket blog post"</em>, watching the exact same match highlights is recognized as <strong>on-track research</strong>!
              </p>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================
          SCREEN 2: ACTIVE SESSION & COMPASS NEEDLE
          ======================================================== */}
      {currentTab === 'active' && (
        <main className={shakeTrigger ? 'shake-animation' : ''}>
          {/* Sticky Session Bar */}
          <div className="session-sticky-header">
            <div className="sticky-goal" title={cleanGoal || goalInput}>
              🎯 {cleanGoal || goalInput}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div className="countdown-display">{formatTime(timeRemainingSec)}</div>
              <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setShowEndConfirmModal(true)}>
                End Session
              </button>
            </div>
          </div>

          {/* Compass Dial & Status */}
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="compass-container">
              <div className={`compass-dial status-${currentStatus}`}>
                <div className="compass-label-north">GOAL</div>

                {/* Rotating Compass Needle */}
                <div
                  className="compass-needle-group"
                  style={{ transform: `rotate(${getNeedleAngle()}deg)` }}
                >
                  <svg viewBox="0 0 200 200" width="100%" height="100%">
                    {/* North pointer (Emerald / On-Track) */}
                    <polygon
                      points="100,28 90,100 100,94 110,100"
                      fill={currentStatus === 'on_track' ? '#10b981' : currentStatus === 'adjacent' ? '#f59e0b' : '#ef4444'}
                      filter="drop-shadow(0 0 8px rgba(56, 189, 248, 0.5))"
                    />
                    {/* South pointer (Crimson / Base) */}
                    <polygon
                      points="100,172 90,100 100,106 110,100"
                      fill="#64748b"
                      opacity="0.6"
                    />
                    {/* Pivot center */}
                    <circle cx="100" cy="100" r="10" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
                    <circle cx="100" cy="100" r="4" fill="#38bdf8" />
                  </svg>
                </div>
              </div>

              <div className={`compass-label-status ${currentStatus}`}>
                {currentStatus === 'on_track' && '● ON TRACK'}
                {currentStatus === 'adjacent' && '▲ ADJACENT TASK'}
                {currentStatus === 'drifted' && '▼ DRIFT DETECTED'}
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 400 }}>
                  ({Math.round(currentConfidence * 100)}% match)
                </span>
              </div>
              <p style={{ marginTop: '6px', fontSize: '0.85rem', color: '#94a3b8', maxWidth: '420px' }}>
                {currentReason}
              </p>
            </div>

            {/* Gentle Nudge Banner if Drifted */}
            {currentStatus === 'drifted' && (
              <div className="nudge-banner">
                <div className="nudge-header">
                  <span>🍃 Gentle Nudge</span>
                </div>
                <p className="nudge-message">{currentNudge || "It looks like focus has drifted. Take a gentle breath and guide yourself back."}</p>
                <div className="nudge-actions">
                  <button
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                    onClick={() => handleLogActivity('Returning back to ' + (cleanGoal || 'primary task'))}
                  >
                    Back on track
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '0.82rem' }}
                    onClick={() => handleLogActivity('Deliberate side task related to ' + (cleanGoal || 'goal'))}
                  >
                    I meant to do this
                  </button>
                </div>
              </div>
            )}

            {/* Activity Logging Box */}
            <div style={{ marginTop: '20px', textAlign: 'left' }}>
              <label className="input-label">Quick Check: What are you doing right now?</label>
              <div className="log-box" style={{ marginTop: '6px' }}>
                <input
                  className="text-input"
                  type="text"
                  placeholder="e.g. Reading documentation, browsing reels, writing functions..."
                  value={activityInput}
                  onChange={e => setActivityInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogActivity()}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleLogActivity()}
                  disabled={isClassifying || !activityInput.trim()}
                >
                  {isClassifying ? 'Checking...' : 'Log'}
                </button>
              </div>

              {/* Quick suggestion tap chips */}
              <div className="activity-suggestion-row">
                <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center' }}>Quick tap:</span>
                {[
                  ...(onTrackExamples.slice(0, 2)),
                  ...(adjacentExamples.slice(0, 2)),
                  ...(driftExamples.slice(0, 1))
                ].map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    className="suggestion-chip"
                    onClick={() => handleLogActivity(sug)}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Session Timeline */}
            <div style={{ textAlign: 'left', marginTop: '24px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
                Activity Timeline ({logs.length} events)
              </h3>
              <div className="timeline-list">
                {[...logs].reverse().map((log, idx) => (
                  <div key={idx} className={`timeline-item ${log.status}`}>
                    <div className="timeline-main">
                      <span className="timeline-activity">{log.activity}</span>
                      {log.reason && <span className="timeline-reason">{log.reason}</span>}
                    </div>
                    <span className="timeline-time">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================
          SCREEN 3: SESSION SUMMARY & METRICS
          ======================================================== */}
      {currentTab === 'summary' && summaryData && (
        <main>
          <div className="card">
            <h2 className="card-title">Session Focus Summary</h2>
            <p className="card-subtitle">
              Detailed breakdown of your session for <strong>{summaryData.goal}</strong>.
            </p>

            {/* Hero Score Ring & Primary Metrics */}
            <div className="summary-hero">
              <div className="score-ring-wrapper">
                <svg viewBox="0 0 160 160" width="160" height="160">
                  <circle
                    cx="80"
                    cy="80"
                    r="65"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="12"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="65"
                    fill="none"
                    stroke={summaryData.focus_score >= 80 ? '#10b981' : summaryData.focus_score >= 50 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="12"
                    strokeDasharray={2 * Math.PI * 65}
                    strokeDashoffset={(2 * Math.PI * 65) * (1 - summaryData.focus_score / 100)}
                    strokeLinecap="round"
                    transform="rotate(-90 80 80)"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                </svg>
                <div className="score-text-center">
                  <span className="score-big-num">{summaryData.focus_score}</span>
                  <span className="score-sublabel">Focus Score</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '220px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(148,163,184,0.1)', paddingBottom: '6px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Total Duration:</span>
                  <strong style={{ color: '#f8fafc' }}>{summaryData.durationMin} min</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(148,163,184,0.1)', paddingBottom: '6px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#34d399' }}>● On-Track Time:</span>
                  <strong style={{ color: '#34d399' }}>{summaryData.time_on_track_min} min</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(148,163,184,0.1)', paddingBottom: '6px' }}>
                  <span style={{ fontSize: '0.85rem', color: '#fbbf24' }}>▲ Adjacent Time:</span>
                  <strong style={{ color: '#fbbf24' }}>{summaryData.time_adjacent_min} min</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: '#f87171' }}>▼ Drift Time:</span>
                  <strong style={{ color: '#f87171' }}>{summaryData.time_drifted_min} min</strong>
                </div>
              </div>
            </div>

            {/* Time Split Horizontal Bar */}
            <div style={{ marginTop: '16px' }}>
              <div className="time-split-bar">
                <div
                  className="bar-segment on_track"
                  style={{ width: `${(summaryData.time_on_track_min / Math.max(1, summaryData.durationMin)) * 100}%` }}
                />
                <div
                  className="bar-segment adjacent"
                  style={{ width: `${(summaryData.time_adjacent_min / Math.max(1, summaryData.durationMin)) * 100}%` }}
                />
                <div
                  className="bar-segment drifted"
                  style={{ width: `${(summaryData.time_drifted_min / Math.max(1, summaryData.durationMin)) * 100}%` }}
                />
              </div>

              <div className="time-split-legend">
                <div className="legend-item">
                  <span className="legend-dot on_track"></span>
                  <span>On-Track ({summaryData.time_on_track_min}m)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot adjacent"></span>
                  <span>Adjacent ({summaryData.time_adjacent_min}m)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot drifted"></span>
                  <span>Drifted ({summaryData.time_drifted_min}m)</span>
                </div>
              </div>
            </div>

            {/* Context Switch Tax Card */}
            <div className="switch-tax-card">
              <h3 className="tax-title">
                ⚡ Context Switch Tax
              </h3>
              <div className="tax-stats-row">
                <div className="tax-stat-box">
                  <span className="tax-stat-val">{summaryData.switch_count}</span>
                  <span className="tax-stat-label">Context Switches</span>
                </div>
                <div className="tax-stat-box">
                  <span className="tax-stat-val" style={{ color: '#fbbf24' }}>
                    {summaryData.context_switch_tax_min.low} - {summaryData.context_switch_tax_min.high} min
                  </span>
                  <span className="tax-stat-label">Estimated Cognitive Refocus Cost</span>
                </div>
              </div>
              <p className="tax-footnote">
                * Research shows that switching attention away from a primary goal costs 10 to 25 minutes of cognitive ramp-up time to regain deep focus state. Transitions between adjacent tasks and drift are counted only when departing from or returning to core work.
              </p>
            </div>

            {/* AI Insight Box */}
            {summaryData.insight && (
              <div className="ai-insight-box">
                "{summaryData.insight}"
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setLogs([]);
                  setCleanGoal('');
                  setCurrentTab('setup');
                }}
              >
                + Start New Session
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentTab('history')}
              >
                View History
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================
          SCREEN 4: SESSION HISTORY
          ======================================================== */}
      {currentTab === 'history' && (
        <main>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2 className="card-title">Session History</h2>
                <p className="card-subtitle" style={{ marginBottom: 0 }}>Past focus sessions stored locally.</p>
              </div>
              {savedSessions.length > 0 && (
                <button
                  className="btn btn-danger"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={() => setDeleteConfirmIndex('all')}
                >
                  Clear All
                </button>
              )}
            </div>

            {savedSessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                <p>No past sessions recorded yet.</p>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '16px' }}
                  onClick={() => setCurrentTab('setup')}
                >
                  Start Your First Session
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {savedSessions.map((sess, idx) => (
                  <div
                    key={sess.id || idx}
                    className="timeline-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedHistorySession(sess)}
                  >
                    <div className="timeline-main">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: '#f8fafc', fontSize: '0.95rem' }}>{sess.goal}</strong>
                        <span style={{ fontSize: '0.78rem', color: '#38bdf8' }}>({sess.durationMin}m)</span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                        {sess.date} • {sess.switch_count} switches • {sess.time_on_track_min}m on-track
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '1.4rem',
                          fontWeight: 800,
                          color: sess.focus_score >= 80 ? '#34d399' : sess.focus_score >= 50 ? '#fbbf24' : '#f87171'
                        }}>
                          {sess.focus_score}
                        </span>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>SCORE</div>
                      </div>
                      <button
                        className="chip-remove-btn"
                        style={{ padding: '4px', fontSize: '1.1rem' }}
                        title="Delete this session"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmIndex(idx);
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* ========================================================
          MODALS & CONFIRMATION SHEETS
          ======================================================== */}

      {/* Periodic Check-In Modal */}
      {showCheckInModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">⏰ Focus Check-in</h3>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: '16px' }}>
              Goal: <strong>{cleanGoal || goalInput}</strong>
              <br />What task are you working on right now?
            </p>
            <input
              className="text-input"
              autoFocus
              type="text"
              placeholder="e.g. solving exercise 4, browsing docs..."
              value={activityInput}
              onChange={e => setActivityInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogActivity()}
            />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowCheckInModal(false)}>
                Snooze
              </button>
              <button className="btn btn-primary" onClick={() => handleLogActivity()} disabled={!activityInput.trim()}>
                Log Activity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Session Confirm Sheet */}
      {showEndConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">End Active Session?</h3>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
              Are you sure you want to finish your focus session early? We'll generate your focus score, time-split breakdown, and context switch tax analysis now.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowEndConfirmModal(false)}>
                Continue Session
              </button>
              <button className="btn btn-danger" onClick={handleEndSession}>
                Finish & View Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time-Up Modal */}
      {showTimeUpModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">🎉 Time's Up!</h3>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
              You've completed your planned {durationMin}-minute focus block for <strong>{cleanGoal || goalInput}</strong>!
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleEndSession}>
                View Session Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Deletion Confirm Modal (No window.confirm) */}
      {deleteConfirmIndex !== null && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Confirm Deletion</h3>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
              {deleteConfirmIndex === 'all'
                ? 'Are you sure you want to permanently delete all recorded session history?'
                : 'Are you sure you want to delete this recorded session from your history?'}
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirmIndex(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (deleteConfirmIndex === 'all') {
                    setSavedSessions([]);
                  } else {
                    setSavedSessions(prev => prev.filter((_, i) => i !== deleteConfirmIndex));
                  }
                  setDeleteConfirmIndex(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Session Details Modal */}
      {selectedHistorySession && (
        <div className="modal-overlay" onClick={() => setSelectedHistorySession(null)}>
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">{selectedHistorySession.goal}</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '14px' }}>
              {selectedHistorySession.date} • {selectedHistorySession.durationMin} minutes
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ background: 'rgba(15,23,42,0.8)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8' }}>{selectedHistorySession.focus_score}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>FOCUS SCORE</div>
              </div>
              <div style={{ background: 'rgba(15,23,42,0.8)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fbbf24' }}>{selectedHistorySession.switch_count}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>SWITCHES</div>
              </div>
              <div style={{ background: 'rgba(15,23,42,0.8)', padding: '10px', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34d399' }}>{selectedHistorySession.time_on_track_min}m</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>ON-TRACK</div>
              </div>
            </div>

            {selectedHistorySession.insight && (
              <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: '#e0f2fe', marginBottom: '14px' }}>
                "{selectedHistorySession.insight}"
              </p>
            )}

            <h4 style={{ fontSize: '0.85rem', color: '#f8fafc', marginBottom: '8px' }}>Logged Activities:</h4>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedHistorySession.logs?.map((l, i) => (
                <div key={i} className={`timeline-item ${l.status}`} style={{ padding: '8px 12px', fontSize: '0.82rem' }}>
                  <span>{l.activity}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{l.status}</span>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedHistorySession(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
