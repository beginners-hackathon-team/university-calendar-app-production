import re


def format_room_for_display(room: str | None) -> str:
    if not room:
        return ""
    text = room
    prev = None
    while prev != text:
        prev = text
        text = re.sub(r"\s*[（(][^（）()]*[）)]\s*", " ", text)
    return re.sub(r"\s+", " ", text).strip()
