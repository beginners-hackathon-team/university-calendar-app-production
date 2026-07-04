from app.services.assignment_filter import is_assignment_candidate
from app.services.course_display import format_room_for_display


def test_format_room_for_display_returns_empty_for_none():
    assert format_room_for_display(None) == ""


def test_format_room_for_display_returns_empty_for_empty_string():
    assert format_room_for_display("") == ""


def test_format_room_for_display_leaves_plain_room_unchanged():
    assert format_room_for_display("第1講義室") == "第1講義室"


def test_format_room_for_display_strips_trailing_annotation():
    assert format_room_for_display("第1講義室（3階）") == "第1講義室"


def test_format_room_for_display_strips_multiple_annotations():
    assert format_room_for_display("教室(A)(B)") == "教室"


def test_format_room_for_display_keeps_separating_space_for_mid_string_annotation():
    assert format_room_for_display("A（注記）B") == "A B"


def test_is_assignment_candidate_true_when_title_has_assignment_keyword():
    assert is_assignment_candidate("Report submission", None) is True


def test_is_assignment_candidate_false_when_kind_is_excluded():
    assert is_assignment_candidate("第1回講義スライド", "資料") is False


def test_is_assignment_candidate_title_keyword_wins_over_excluded_kind():
    # kindが除外対象でも、タイトルに課題キーワードがあれば候補として残す
    assert is_assignment_candidate("提出物について", "資料") is True


def test_is_assignment_candidate_false_when_title_has_excluded_keyword():
    assert is_assignment_candidate("Room for Questions", None) is False


def test_is_assignment_candidate_defaults_to_true_when_ambiguous():
    assert is_assignment_candidate("学籍確認のお知らせ", None) is True
