import pytest
from mock_classifier import extract_duration_and_goal, mock_classify
from main import calculate_session_metrics
from models import LogEntry


def test_duration_and_goal_extraction():
    # Minutes extraction
    goal, duration = extract_duration_and_goal("Learn Python for my exam in 45m")
    assert "Learn Python for my exam" in goal
    assert duration == 45

    # Hours extraction
    goal2, duration2 = extract_duration_and_goal("Finish research report, 1.5 hours")
    assert "Finish research report" in goal2
    assert duration2 == 90

    # Explicit minutes format
    goal3, duration3 = extract_duration_and_goal("Write DBMS paper for 90 minutes")
    assert "Write DBMS paper" in goal3
    assert duration3 == 90

    # No duration provided -> defaults to 45
    goal4, duration4 = extract_duration_and_goal("Organize desk and notes", default_duration=45)
    assert goal4 == "Organize desk and notes"
    assert duration4 == 45


def test_context_switch_counting():
    """
    Transitions between on_track and non-on_track (adjacent/drifted) count as a switch.
    Transitions between adjacent and drifted do NOT count as a switch.
    """
    # 1. on_track -> adjacent -> drifted -> on_track
    # - on_track -> adjacent: 1 switch
    # - adjacent -> drifted: 0 switch
    # - drifted -> on_track: 1 switch
    # Total = 2
    logs = [
        LogEntry(timestamp=1000, activity="Writing code", status="on_track"),
        LogEntry(timestamp=1010, activity="Checking docs", status="adjacent"),
        LogEntry(timestamp=1020, activity="Instagram reel", status="drifted"),
        LogEntry(timestamp=1030, activity="Writing code", status="on_track"),
    ]
    metrics = calculate_session_metrics(logs, duration_min=40)
    assert metrics["switch_count"] == 2

    # 2. on_track -> on_track -> on_track
    # Total = 0
    logs_pure = [
        LogEntry(timestamp=1000, activity="Task 1", status="on_track"),
        LogEntry(timestamp=1010, activity="Task 2", status="on_track"),
        LogEntry(timestamp=1020, activity="Task 3", status="on_track"),
    ]
    metrics_pure = calculate_session_metrics(logs_pure, duration_min=30)
    assert metrics_pure["switch_count"] == 0

    # 3. adjacent -> drifted -> adjacent
    # Both are non-on_track, so switch_count must be 0
    logs_non_track = [
        LogEntry(timestamp=1000, activity="Stretch", status="adjacent"),
        LogEntry(timestamp=1010, activity="News", status="drifted"),
        LogEntry(timestamp=1020, activity="Water break", status="adjacent"),
    ]
    metrics_non_track = calculate_session_metrics(logs_non_track, duration_min=30)
    assert metrics_non_track["switch_count"] == 0


def test_focus_score_calculations():
    # Pure on_track
    logs_100 = [
        LogEntry(timestamp=100, activity="A", status="on_track"),
        LogEntry(timestamp=200, activity="B", status="on_track"),
    ]
    m100 = calculate_session_metrics(logs_100, duration_min=30)
    assert m100["focus_score"] == 100

    # Pure adjacent: 0.5 * 100 = 50
    logs_50 = [
        LogEntry(timestamp=100, activity="A", status="adjacent"),
        LogEntry(timestamp=200, activity="B", status="adjacent"),
    ]
    m50 = calculate_session_metrics(logs_50, duration_min=30)
    assert m50["focus_score"] == 50

    # Pure drifted: 0.0 * 100 = 0
    logs_0 = [
        LogEntry(timestamp=100, activity="A", status="drifted"),
        LogEntry(timestamp=200, activity="B", status="drifted"),
    ]
    m0 = calculate_session_metrics(logs_0, duration_min=30)
    assert m0["focus_score"] == 0

    # 50% on_track, 50% adjacent: (1.0*15 + 0.5*15) / 30 * 100 = 22.5/30 * 100 = 75
    logs_75 = [
        LogEntry(timestamp=0, activity="Coding", status="on_track"),
        LogEntry(timestamp=900, activity="Docs", status="adjacent"),
        LogEntry(timestamp=1800, activity="Done", status="adjacent"),
    ]
    m75 = calculate_session_metrics(logs_75, duration_min=30, session_start_timestamp=0, session_end_timestamp=1800)
    assert m75["focus_score"] == 75

    # 50% on_track, 50% drifted: (1.0*15 + 0.0*15) / 30 * 100 = 50
    logs_half_drift = [
        LogEntry(timestamp=0, activity="Coding", status="on_track"),
        LogEntry(timestamp=900, activity="Video", status="drifted"),
        LogEntry(timestamp=1800, activity="End", status="drifted"),
    ]
    m_half = calculate_session_metrics(logs_half_drift, duration_min=30, session_start_timestamp=0, session_end_timestamp=1800)
    assert m_half["focus_score"] == 50


def test_empty_and_single_log_boundaries():
    # Empty logs
    m_empty = calculate_session_metrics([], duration_min=45)
    assert m_empty["focus_score"] == 100
    assert m_empty["switch_count"] == 0

    # Single log
    m_single = calculate_session_metrics(
        [LogEntry(timestamp=1000, activity="Coding", status="on_track")],
        duration_min=45
    )
    assert m_single["focus_score"] == 100
    assert m_single["switch_count"] == 0


def test_mock_classification_core_cases():
    # 1. On-track coding
    res = mock_classify("Learn Python for my exam", "Python loops tutorial and code practice")
    assert res["status"] == "on_track"

    # 2. Adjacent assist / notes
    res_adj = mock_classify("Finish DBMS assignment", "Organize notes folder and check diagram")
    assert res_adj["status"] == "adjacent"

    # 3. Distraction
    res_drift = mock_classify("Learn Python for my exam", "Watching IPL cricket highlights")
    assert res_drift["status"] == "drifted"
    assert res_drift["nudge"] != ""

    # 4. Contextual polarity (cricket blog vs python exam)
    res_blog = mock_classify("Write cricket blog post", "Watching IPL highlights and stats")
    assert res_blog["status"] == "on_track"
