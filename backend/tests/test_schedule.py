from datetime import date

import pytest

from app.services.schedule import build_class_dates, get_quarter_range


def test_get_quarter_range_returns_expected_bounds():
    start, end = get_quarter_range(2026, 1)
    assert start == date(2026, 4, 6)
    assert end == date(2026, 6, 4)


def test_get_quarter_range_quarter4_spans_into_next_year():
    start, end = get_quarter_range(2026, 4)
    assert start == date(2026, 12, 9)
    assert end == date(2027, 2, 10)


def test_get_quarter_range_invalid_quarter_raises():
    with pytest.raises(ValueError):
        get_quarter_range(2026, 5)


def test_build_class_dates_returns_only_matching_weekday():
    dates = build_class_dates(2026, 1, "月")
    assert len(dates) > 0
    assert all(d.weekday() == 0 for d in dates)
    start, end = get_quarter_range(2026, 1)
    assert all(start <= d <= end for d in dates)


def test_build_class_dates_different_days_yield_different_counts_are_consistent():
    monday_dates = build_class_dates(2026, 1, "月")
    sunday_dates = build_class_dates(2026, 1, "日")
    # 同じ期間内なので日数の差は最大でも1日
    assert abs(len(monday_dates) - len(sunday_dates)) <= 1


def test_build_class_dates_invalid_day_of_week_raises():
    with pytest.raises(ValueError):
        build_class_dates(2026, 1, "祝")
