import json
import sys
from pathlib import Path
from app.models.university_event import University_event
from app.db.session import SessionLocal


def seed(json_path: Path) -> None:
    with json_path.open(encoding="utf-8") as f:
        data = json.load(f)

    year = data["year"]
    events = data["events"]

    db = SessionLocal()
    try:
        db.query(University_event).filter(University_event.year == year).delete()

        for item in events:
            db.add(
                University_event(
                    year=year,
                    name=item["name"],
                    type=item["type"],
                    date=item["date"],
                    original_day=item.get("other", ""),
                )
            )
        db.commit()
        print(f"{year}_{len(events)}件投入しました")
    finally:
        db.close()


if __name__ == "__main__":
    path = Path(sys.argv[1])
    seed(path)
