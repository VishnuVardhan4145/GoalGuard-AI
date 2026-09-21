import os
import sys
import json
import argparse
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from mock_classifier import mock_classify
import llm


def load_dataset(file_path: Path):
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def evaluate_dataset(cases, use_mock: bool = True):
    passed = 0
    mismatches = []

    for item in cases:
        cid = item.get("id", "unknown")
        goal = item["goal"]
        activity = item["activity"]
        expected = item["expected"]
        recent = item.get("recent_activities", [])

        if use_mock:
            res = mock_classify(goal=goal, activity=activity, recent_activities=recent)
            actual = res["status"]
            confidence = res["confidence"]
            reason = res["reason"]
        else:
            res = llm.classify_activity(goal=goal, activity=activity, recent_activities=recent)
            actual = res.status
            confidence = res.confidence
            reason = res.reason

        if actual == expected:
            passed += 1
        else:
            mismatches.append({
                "id": cid,
                "goal": goal,
                "activity": activity,
                "expected": expected,
                "actual": actual,
                "confidence": confidence,
                "reason": reason
            })

    accuracy = (passed / len(cases)) * 100.0 if cases else 0.0
    return passed, len(cases), accuracy, mismatches


def main():
    parser = argparse.ArgumentParser(description="Evaluate GoalGuard AI Classifier")
    parser.add_argument("--mock", action="store_true", default=True, help="Force mock offline classifier")
    parser.add_argument("--live", action="store_true", help="Use live Gemini model (requires GEMINI_API_KEY)")
    parser.add_argument("--holdout", action="store_true", default=True, help="Include holdout dataset")
    args = parser.parse_args()

    use_mock = not args.live

    tests_dir = Path(__file__).resolve().parent
    core_file = tests_dir / "classifier_cases.json"
    holdout_file = tests_dir / "holdout_cases.json"

    print("=" * 60)
    print(f"GoalGuard AI Classifier Evaluation [Mode: {'Mock' if use_mock else 'Live Gemini'}]")
    print("=" * 60)

    all_passed = 0
    all_total = 0
    all_mismatches = []

    # 1. Core dataset
    if core_file.exists():
        core_cases = load_dataset(core_file)
        p, t, acc, mismatches = evaluate_dataset(core_cases, use_mock=use_mock)
        all_passed += p
        all_total += t
        all_mismatches.extend(mismatches)
        print(f"\nCore Cases: {p}/{t} passed ({acc:.1f}%)")

    # 2. Holdout dataset
    if args.holdout and holdout_file.exists():
        holdout_cases = load_dataset(holdout_file)
        hp, ht, hacc, hmismatches = evaluate_dataset(holdout_cases, use_mock=use_mock)
        all_passed += hp
        all_total += ht
        all_mismatches.extend(hmismatches)
        print(f"Holdout Cases: {hp}/{ht} passed ({hacc:.1f}%)")

    total_acc = (all_passed / all_total * 100.0) if all_total else 0.0
    print("\n" + "-" * 60)
    print(f"TOTAL EVALUATION: {all_passed}/{all_total} correct ({total_acc:.1f}%)")
    print("-" * 60)

    if all_mismatches:
        print("\nMismatches:")
        for m in all_mismatches:
            print(f"  [{m['id']}] Expected '{m['expected']}', got '{m['actual']}'")
            print(f"       Goal: \"{m['goal']}\"")
            print(f"       Activity: \"{m['activity']}\"")
            print(f"       Reason: {m['reason']}\n")

    if total_acc >= 85.0:
        print(f"\n[PASS] Target accuracy achieved ({total_acc:.1f}% >= 85.0%)")
        sys.exit(0)
    else:
        print(f"\n[FAIL] Target accuracy below benchmark ({total_acc:.1f}% < 85.0%)")
        sys.exit(1)


if __name__ == "__main__":
    main()
