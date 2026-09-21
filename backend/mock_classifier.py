import re
from typing import List, Tuple, Dict, Any, Optional

# Basic stopwords
STOPWORDS = {
    "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "with", "of",
    "my", "your", "our", "their", "his", "her", "about", "how", "is", "are", "was",
    "were", "be", "been", "being", "do", "does", "did", "i", "me", "we", "you",
    "it", "this", "that", "these", "those", "by", "from", "up", "down", "into",
    "over", "after", "before", "so", "some", "any", "no", "not", "only", "own",
    "same", "than", "too", "very", "can", "will", "just", "should", "now"
}

def stem(word: str) -> str:
    """Lightweight rule-based stemmer."""
    w = word.lower().strip()
    if len(w) <= 3:
        return w
    # Common suffix stripping
    if w.endswith("sses"):
        w = w[:-2]
    elif w.endswith("ies"):
        w = w[:-2]
    elif w.endswith("ss"):
        pass
    elif w.endswith("s") and not w.endswith("us") and not w.endswith("is"):
        w = w[:-1]
    
    if len(w) > 4:
        if w.endswith("eed"):
            w = w[:-1]
        elif w.endswith("ed"):
            w = w[:-2]
        elif w.endswith("ing"):
            w = w[:-3]
        elif w.endswith("tion"):
            w = w[:-4] + "t"
        elif w.endswith("ment"):
            w = w[:-4]
        elif w.endswith("ly"):
            w = w[:-2]
        elif w.endswith("er") or w.endswith("or"):
            w = w[:-2]
    return w

def tokenize_and_stem(text: str) -> List[str]:
    """Tokenize text, remove non-alphanumeric, drop stopwords, and stem tokens."""
    raw_tokens = re.findall(r'[a-zA-Z0-9_+#]+', text.lower())
    stemmed = []
    for t in raw_tokens:
        if t not in STOPWORDS and len(t) > 1:
            stemmed.append(stem(t))
    return stemmed

# Pre-stemmed word lists
PLATFORM_WORDS = {stem(w) for w in ["youtube", "video", "watch", "browser", "tab", "site", "web", "app", "window"]}
GENERIC_WORDS = {stem(w) for w in ["tutorial", "lecture", "notes", "guide", "overview", "basics", "learn", "study", "work", "read", "chapter"]}

DISTRACTION_LEXICON = {
    stem(w) for w in [
        "instagram", "reels", "netflix", "ipl", "memes", "meme", "gaming", "game",
        "shopping", "amazon", "flipkart", "tiktok", "twitter", "x.com", "reddit",
        "facebook", "snapchat", "tinder", "dating", "twitch", "anime", "manga",
        "celebrity", "gossip", "trailer", "movie", "series", "highlights"
    ]
}

ASSIST_WORDS = {
    stem(w) for w in [
        "stackoverflow", "stack", "overflow", "error", "organize", "organizing",
        "folder", "install", "installation", "installing", "setup", "break",
        "doc", "docs", "documentation", "reference", "cheat", "cheatsheet", "terminal", "config",
        "guideline", "guidelines", "rubric", "syllabus", "citation", "citations",
        "scholar", "formatting", "format", "download", "downloading", "template", "templates",
        "sync", "syncing", "dictionary", "timer", "schedule"
    ]
}

WORK_VERBS = {
    stem(w) for w in [
        "writing", "write", "solving", "solve", "debugging", "debug", "coding",
        "code", "implementing", "implement", "building", "build", "practicing",
        "practice", "drafting", "draft", "calculating", "calculate", "creating", "create",
        "drawing", "draw", "running", "run", "doing"
    ]
}

# Domain vocabulary packs for mock /intent and classifier boost
DOMAIN_PACKS = {
    "coding": {
        "keywords": {stem(w) for w in ["python", "javascript", "react", "code", "coding", "programming", "algorithm", "developer", "bug", "software", "api", "backend", "frontend", "loops", "recursion", "portfolio", "navbar", "website"]},
        "on_track": [
            "Writing core functions in editor",
            "Debugging failing test cases",
            "Implementing API endpoints",
            "Working through practice coding exercises",
            "Watching targeted language loops tutorial"
        ],
        "adjacent": [
            "Reading official documentation for syntax reference",
            "Checking Stack Overflow for error traceback",
            "Organizing project folders and config files",
            "Short 5-min stretch break before next module"
        ],
        "drift": [
            "Scrolling Instagram reels or social feed",
            "Browsing online shopping sales",
            "Watching sports or gaming highlight clips",
            "Checking unrelated gossip feeds"
        ]
    },
    "database": {
        "keywords": {stem(w) for w in ["dbms", "database", "sql", "normalization", "schema", "table", "query", "postgres", "mysql", "mongodb", "relational", "erd", "diagram", "requirements"]},
        "on_track": [
            "Writing and executing SQL queries",
            "Watching normalization explained tutorial on YouTube",
            "Designing entity relationship diagram (ERD)",
            "Solving assignment schema normalization questions",
            "Testing primary and foreign key constraints"
        ],
        "adjacent": [
            "Organizing lecture slides and notes folder",
            "Looking up syntax on PostgreSQL docs",
            "Setting up local database connection credentials",
            "Reviewing professor's grading rubric"
        ],
        "drift": [
            "Scrolling Instagram reels or TikTok",
            "Watching random movie trailers on YouTube",
            "Browsing Reddit gaming threads",
            "Checking online fashion sales"
        ]
    },
    "writing": {
        "keywords": {stem(w) for w in ["writing", "essay", "blog", "article", "report", "draft", "paper", "manuscript", "cricket", "story", "scholar", "citation", "introduction", "research"]},
        "on_track": [
            "Drafting introduction and body paragraphs",
            "Reviewing source material for key arguments",
            "Writing analysis and concluding thoughts",
            "Outlining section headings and examples",
            "Watching specific subject reference video"
        ],
        "adjacent": [
            "Formatting citations and references",
            "Organizing research notes and bookmarks",
            "Checking grammar and phrasing in dictionary",
            "Structuring headings in Google Docs"
        ],
        "drift": [
            "Checking social media notifications",
            "Online browsing on retail stores",
            "Watching unrelated comedy sketches",
            "Playing mobile games"
        ]
    },
    "fitness": {
        "keywords": {stem(w) for w in ["workout", "exercise", "fitness", "gym", "run", "running", "cardio", "stretch", "training", "bench", "press", "dumbbell", "sets", "reps", "5k", "pace", "distance"]},
        "on_track": [
            "Completing primary workout sets and reps",
            "Following core exercise routine",
            "High-intensity interval interval session",
            "Active running or cardio session"
        ],
        "adjacent": [
            "Adjusting workout timer or interval app",
            "Logging completed sets in tracker",
            "Hydration break and brief heart-rate check",
            "Checking form tutorial video for target exercise"
        ],
        "drift": [
            "Browsing social media feeds on the bench",
            "Answering unrelated chat messages",
            "Watching unrelated stream clips",
            "Prolonged distraction on phone"
        ]
    },
    "study": {
        "keywords": {stem(w) for w in ["study", "exam", "assignment", "revision", "chapter", "math", "physics", "history", "biology", "calculus", "derivative", "derivatives", "chain", "rule", "chemistry", "benzene", "chemdraw", "reaction", "slides", "spanish", "verbs", "conjugation", "subjunctive", "finance", "budget", "variance", "excel", "spreadsheet", "flashcards"]},
        "on_track": [
            "Solving textbook practice problems",
            "Reviewing core chapter concepts and theorems",
            "Active recall testing with flashcards",
            "Watching focused chapter lecture video"
        ],
        "adjacent": [
            "Organizing notes folder and binder",
            "Looking up formula clarification online",
            "Printing previous year exam papers",
            "Quick 5-minute hydration break"
        ],
        "drift": [
            "Scrolling Instagram reels or YouTube shorts",
            "Checking friend group chats about weekend plans",
            "Browsing online shopping catalogs",
            "Watching video game livestreams"
        ]
    }
}

def extract_duration_and_goal(raw_text: str, default_duration: int = 45) -> Tuple[str, int]:
    """
    Extract duration if present in goal string (e.g. '90 min', '1.5 hours', '45m')
    and strip it from the goal text.
    """
    cleaned = raw_text.strip()
    duration = default_duration

    # Check hours first (e.g. 1.5 hours, 2 hrs, 1h)
    hour_match = re.search(r'(?:,\s*|\s+for\s+|\s+in\s+|\s+)(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b', cleaned, re.IGNORECASE)
    if hour_match:
        try:
            val = float(hour_match.group(1))
            duration = int(round(val * 60))
            cleaned = cleaned[:hour_match.start()] + cleaned[hour_match.end():]
        except ValueError:
            pass
    else:
        # Check minutes (e.g. 90 min, 45 mins, 30m, 90 minutes)
        min_match = re.search(r'(?:,\s*|\s+for\s+|\s+in\s+|\s+)(\d+)\s*(?:minutes?|mins?|m)\b', cleaned, re.IGNORECASE)
        if min_match:
            try:
                duration = int(min_match.group(1))
                cleaned = cleaned[:min_match.start()] + cleaned[min_match.end():]
            except ValueError:
                pass

    # Clean up trailing punctuation, commas, or extra whitespace
    cleaned = re.sub(r'[\s,;-]+$', '', cleaned).strip()
    if not cleaned:
        cleaned = raw_text.strip()
    return cleaned, duration

def detect_domain(goal_text: str) -> str:
    """Detect domain category from goal text."""
    stems = set(tokenize_and_stem(goal_text))
    best_domain = "generic"
    max_overlap = 0
    for dom, data in DOMAIN_PACKS.items():
        overlap = len(stems & data["keywords"])
        if overlap > max_overlap:
            max_overlap = overlap
            best_domain = dom
    return best_domain

def generate_mock_intent(goal_text: str, duration_min: Optional[int] = None) -> Dict[str, Any]:
    """Generate parsed intent with 4-6 realistic examples per category."""
    clean_goal, parsed_duration = extract_duration_and_goal(goal_text, duration_min or 45)
    domain = detect_domain(clean_goal)
    
    pack = DOMAIN_PACKS.get(domain)
    if not pack:
        # Generic fallback pack
        pack = {
            "on_track": [
                f"Actively working on {clean_goal}",
                f"Reading reference materials directly related to {clean_goal}",
                f"Solving exercises or drafting parts for {clean_goal}",
                f"Reviewing core steps to complete {clean_goal}"
            ],
            "adjacent": [
                f"Organizing files and notes for {clean_goal}",
                "Looking up specific reference or definition",
                "Setting up tools and workspace",
                "Taking a planned 5-minute breather"
            ],
            "drift": [
                "Browsing social media feeds or reels",
                "Watching unrelated entertainment videos",
                "Online shopping and browsing discounts",
                "Chatting in unrelated messenger groups"
            ]
        }
    
    # Customise examples slightly if specific keywords are present
    goal_words = clean_goal.split()
    subject = " ".join(goal_words[:4]) if len(goal_words) > 0 else clean_goal
    
    on_track = [ex.replace("DBMS", subject).replace("Python", subject) for ex in pack["on_track"]]
    adjacent = list(pack["adjacent"])
    drift = list(pack["drift"])

    return {
        "goal": clean_goal,
        "duration_min": parsed_duration,
        "on_track_examples": on_track[:5],
        "adjacent_examples": adjacent[:4],
        "drift_examples": drift[:4]
    }

def mock_classify(
    goal: str,
    activity: str,
    on_track_examples: Optional[List[str]] = None,
    adjacent_examples: Optional[List[str]] = None,
    drift_examples: Optional[List[str]] = None,
    recent_activities: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Offline heuristic classifier following the specification:
    - Stemmed tokens, drop stopwords.
    - Word lists applied AFTER stemming.
    - Distraction words count ONLY if word NOT in goal.
    - Assist words -> adjacent unless work verbs present.
    - Music/messaging contextual checks.
    - Gradual drift tracking.
    """
    on_track_examples = on_track_examples or []
    adjacent_examples = adjacent_examples or []
    drift_examples = drift_examples or []
    recent_activities = recent_activities or []

    goal_tokens = set(tokenize_and_stem(goal))
    act_tokens = tokenize_and_stem(activity)
    act_token_set = set(act_tokens)

    # Expand goal context for domain-specific subjects (e.g. cricket -> ipl, highlights, stats; game dev -> game)
    goal_lower = goal.lower()
    if any(w in goal_lower for w in ["cricket", "ipl", "sport"]):
        goal_tokens.update({stem(w) for w in ["cricket", "ipl", "match", "highlights", "stats", "score", "player", "tournament"]})
    if any(w in goal_lower for w in ["game dev", "game development", "unity", "unreal", "godot"]):
        goal_tokens.update({stem(w) for w in ["game", "gaming", "playtest", "level", "asset"]})
    if any(w in goal_lower for w in ["movie", "cinema", "film", "screenplay"]):
        goal_tokens.update({stem(w) for w in ["movie", "trailer", "film", "scene"]})

    # 1. Distraction lexicon check (only trigger if word NOT in goal)
    distraction_hits = (act_token_set & DISTRACTION_LEXICON) - goal_tokens

    # 3. Assist words check
    assist_hits = act_token_set & ASSIST_WORDS
    work_verb_hits = act_token_set & WORK_VERBS

    # 4. Music / Messaging rules
    activity_lower = activity.lower()
    is_messaging = any(w in activity_lower for w in ["whatsapp", "telegram", "slack", "discord", "messages", "chat"])
    is_music = any(w in activity_lower for w in ["spotify", "playlist", "lofi", "music", "song", "audio"])

    messaging_task_related = False
    if is_messaging:
        # Check if message is about task/goal
        task_indicators = ["doubt", "assignment", "project", "exam", "submission", "query", "code", "prof", "partner", "team", "classmate", "question", "help", "example", "problem", "recursion", "slide", "homework", "lab", "peer"]
        task_indicators_stems = {stem(t) for t in task_indicators} | goal_tokens
        if (act_token_set & task_indicators_stems) or ("study group" in activity_lower) or ("group project" in activity_lower):
            messaging_task_related = True

    music_study_related = False
    if is_music:
        study_music_terms = ["lofi", "study", "focus", "instrumental", "ambient", "binaural", "background", "classical"]
        if any(term in activity_lower for term in study_music_terms):
            music_study_related = True

    # 5. Domain relevance & example overlap
    domain = detect_domain(goal)
    domain_kw = DOMAIN_PACKS.get(domain, {}).get("keywords", set())

    # Build on_track example tokens (weight less than goal, more than generic)
    example_on_track_tokens = set()
    for ex in on_track_examples:
        example_on_track_tokens.update(tokenize_and_stem(ex))
    # Exclude platform and generic words from positive boost
    example_on_track_tokens = (example_on_track_tokens - PLATFORM_WORDS) - GENERIC_WORDS

    # Score calculation
    goal_overlap = act_token_set & goal_tokens
    domain_overlap = (act_token_set & domain_kw) - goal_tokens
    example_overlap = (act_token_set & example_on_track_tokens) - goal_tokens - domain_kw

    # Non-generic content words in activity
    content_act_tokens = (act_token_set - PLATFORM_WORDS) - GENERIC_WORDS

    # Weighting:
    # Goal words = 4.0, Domain = 2.5, Example = 1.5, Generic = 0.1
    on_track_score = (len(goal_overlap) * 4.0) + (len(domain_overlap) * 2.5) + (len(example_overlap) * 1.5)

    # 6. Check gradual drift from recent_activities
    # E.g. recent_activities: ["reading docs [on_track]", "checking config [adjacent]", "quick stretch [adjacent]"]
    is_gradual_drift = False
    if len(recent_activities) >= 2:
        last_two = recent_activities[-2:]
        if all("[adjacent]" in r.lower() or "[drifted]" in r.lower() for r in last_two):
            is_gradual_drift = True

    # --- CLASSIFICATION DECISION ---

    # Case A: Clear Distraction Lexicon match (not in goal)
    if distraction_hits:
        reason = f"Activity involves {', '.join(distraction_hits)} which is unrelated to '{goal}'."
        nudge = f"Take a mindful breath. Let's step back from {list(distraction_hits)[0]} and refocus on your goal."
        return {
            "status": "drifted",
            "confidence": 0.92,
            "reason": reason[:100],
            "nudge": nudge[:120],
            "fallback": True
        }

    # Case B: Messaging
    if is_messaging:
        if messaging_task_related:
            return {
                "status": "adjacent",
                "confidence": 0.85,
                "reason": "Discussing or asking questions related to your goal.",
                "nudge": "",
                "fallback": True
            }
        else:
            return {
                "status": "drifted",
                "confidence": 0.90,
                "reason": "Social chatting or unrelated messaging distracts from your goal.",
                "nudge": "Consider putting messages on pause so you can finish your focus block.",
                "fallback": True
            }

    # Case C: Music / Audio
    if is_music:
        if music_study_related:
            return {
                "status": "adjacent",
                "confidence": 0.88,
                "reason": "Study/focus audio supportive of deep work session.",
                "nudge": "",
                "fallback": True
            }
        else:
            return {
                "status": "drifted",
                "confidence": 0.85,
                "reason": "Browsing music or leisure playlists takes focus away from current work.",
                "nudge": "Put on a simple background playlist and dive back in.",
                "fallback": True
            }

    # Case D: Assist words (documentation, cheat sheet, error, notes folder, install, format, guidelines, download, sync, etc.)
    if assist_hits:
        if is_gradual_drift:
            # If user had 2 non-on_track activities and is now doing weak adjacent -> drifted
            return {
                "status": "drifted",
                "confidence": 0.82,
                "reason": "Gradual drift: prolonged secondary activities without returning to core work.",
                "nudge": "You've spent a while on prep and side tasks. Ready to tackle the main goal?",
                "fallback": True
            }
        return {
            "status": "adjacent",
            "confidence": 0.86,
            "reason": "Supportive task or reference material assisting your primary focus.",
            "nudge": "",
            "fallback": True
        }

    # Case E: High goal/domain/example overlap with work verbs or relevant topic
    if on_track_score >= 2.5 or (goal_overlap and (work_verb_hits or len(content_act_tokens) <= 3)):
        return {
            "status": "on_track",
            "confidence": min(0.95, 0.75 + (on_track_score * 0.05)),
            "reason": "Directly advances the core objectives of your session goal.",
            "nudge": "",
            "fallback": True
        }

    # Case F: Moderate domain overlap or assist overlap
    if on_track_score >= 1.5 or assist_hits:
        if is_gradual_drift and on_track_score < 2.0:
            return {
                "status": "drifted",
                "confidence": 0.80,
                "reason": "Activity is only loosely related after multiple non-track steps.",
                "nudge": "Let's shift focus back toward completing your core assignment.",
                "fallback": True
            }
        return {
            "status": "adjacent",
            "confidence": 0.78,
            "reason": "Related topic or reference material supportive of the goal.",
            "nudge": "",
            "fallback": True
        }

    # Case G: No overlap, unknown or off-topic activity
    return {
        "status": "drifted",
        "confidence": 0.85,
        "reason": f"Activity does not appear to directly support '{goal}'.",
        "nudge": "Gently return to your primary task when you're ready.",
        "fallback": True
    }
