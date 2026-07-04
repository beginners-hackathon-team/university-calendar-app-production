_ASSIGNMENT_TITLE_KEYWORDS = frozenset(
    [
        "submission",
        "submit",
        "提出",
        "レポート",
        "reaction paper",
        "quiz",
        "test",
    ]
)
_EXCLUDE_KINDS = frozenset(["資料", "掲示板"])
_EXCLUDE_TITLE_KEYWORDS = frozenset(
    [
        "lesson materials",
        "material",
        "資料",
        "room for questions",
        "掲示板",
        "forum",
    ]
)


def is_assignment_candidate(task_name: str, kind: str | None) -> bool:
    title_lower = (task_name or "").lower()
    if any(kw.lower() in title_lower for kw in _ASSIGNMENT_TITLE_KEYWORDS):
        return True
    if kind and kind in _EXCLUDE_KINDS:
        return False
    if any(kw.lower() in title_lower for kw in _EXCLUDE_TITLE_KEYWORDS):
        return False
    return True
