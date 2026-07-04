from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from app.core.config import settings

_TEMPLATE_PATH = Path(__file__).parent.parent / "templates" / "privacy_policy.html"
_PRIVACY_POLICY_HTML = _TEMPLATE_PATH.read_text(encoding="utf-8").replace(
    "__APP_URL__", settings.app_url
)

router = APIRouter()


@router.get("/privacy", include_in_schema=False)
def privacy_policy():
    return HTMLResponse(content=_PRIVACY_POLICY_HTML)
