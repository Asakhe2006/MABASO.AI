"""
Simple timetable generator implementing the rules:
- No more than 2 same-subject sessions consecutively
- Prefer alternating categories where possible
- Insert spaced repetition (revision) slots separated from learning
- Prioritize hard subjects in earlier slots
- Return diagnostics with warnings (e.g., anti-burnout)

This implementation is intentionally small and deterministic for the PR.
"""
from datetime import datetime, timedelta
from collections import defaultdict, deque

# Example subjects structure expected in params or sessions input:
# subjects = [
#   {"id": "s1", "subject": "Math", "difficulty": 9, "category": "learning"},
#   ...
# ]

MAX_CONSECUTIVE_SAME = 2


def score_subject(sub):
    # higher difficulty -> higher priority
    return sub.get("difficulty", 5)


def generate(params):
    # params may contain 'subjects' or fallback sample
    subjects = params.get("subjects") if isinstance(params, dict) else None
    if not subjects:
        # fallback sample timetable generator
        subjects = [
            {"id": "math_1", "subject": "Math", "difficulty": 9, "category": "learning"},
            {"id": "eng_1", "subject": "English", "difficulty": 5, "category": "learning"},
            {"id": "rev_1", "subject": "Math Rev", "difficulty": 6, "category": "revision"},
            {"id": "sci_1", "subject": "Physics", "difficulty": 8, "category": "learning"},
            {"id": "hist_1", "subject": "History", "difficulty": 3, "category": "learning"},
        ]

    # Sort by difficulty to prefer hard subjects earlier
    subjects_sorted = sorted(subjects, key=lambda s: -score_subject(s))

    # simple greedy scheduler with category alternation
    result = []
    diagnostics = {"warnings": []}

    # group by category to try alternating
    by_cat = defaultdict(deque)
    for s in subjects_sorted:
        by_cat[s.get("category", "learning")].append(s)

    # categories order attempt: learning -> revision -> learning
    categories = list(by_cat.keys())
    if not categories:
        return [], diagnostics

    last_subject = None
    consecutive = 0
    slot_index = 0
    max_slots = max(20, len(subjects_sorted) * 3)

    # Produce up to max_slots entries
    while slot_index < max_slots and any(by_cat.values()):
        # pick next category trying to alternate
        # find category that's not same as previous category if possible
        pick_cat = None
        for cat in categories:
            if by_cat[cat] and (not result or result[-1].get("category") != cat):
                pick_cat = cat
                break
        if not pick_cat:
            # fallback to first non-empty
            for cat in categories:
                if by_cat[cat]:
                    pick_cat = cat
                    break
        if not pick_cat:
            break

        candidate = by_cat[pick_cat][0]
        # enforce no more than MAX_CONSECUTIVE_SAME subjects
        if last_subject and candidate.get("subject") == last_subject and consecutive >= MAX_CONSECUTIVE_SAME:
            # try to find alternative
            alt_found = False
            for cat in categories:
                if not by_cat[cat]:
                    continue
                for s in by_cat[cat]:
                    if s.get("subject") != last_subject:
                        candidate = s
                        alt_found = True
                        break
                if alt_found:
                    break
            if not alt_found:
                diagnostics["warnings"].append("Could not avoid >%d consecutive sessions of %s" % (MAX_CONSECUTIVE_SAME, last_subject))

        # pop candidate from its deque
        # handle the case we selected something not at left
        dq = by_cat[candidate.get("category")]
        # remove candidate
        for i, s in enumerate(dq):
            if s is candidate:
                dq.rotate(-i)
                dq.popleft()
                dq.rotate(i)
                break

        # append to schedule
        slot = {
            "slot": slot_index,
            "id": candidate.get("id"),
            "subject": candidate.get("subject"),
            "category": candidate.get("category"),
            "assigned_at": datetime.utcnow().isoformat(),
        }
        result.append(slot)

        if last_subject and candidate.get("subject") == last_subject:
            consecutive += 1
        else:
            consecutive = 1
            last_subject = candidate.get("subject")

        slot_index += 1

        # Simple anti-burnout: if too many high difficulty in a short window, warn
        window = result[-5:]
        hard_count = sum(1 for x in window if any(s.get("subject") == x.get("subject") and s.get("category") == "learning" for s in subjects))
        if hard_count >= 4:
            diagnostics["warnings"].append("anti-burnout: many hard learning slots in a short window")
            break

    # compact result to reasonable length
    result = result[:max(10, len(subjects)*2)]

    return result, diagnostics
