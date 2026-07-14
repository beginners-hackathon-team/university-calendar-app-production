"""E2E検証用エントリーポイント。

`.claude/skills/verify/SKILL.md` にあった「認証バイパス版バックエンド」の
手動手順（`.verify_server.py` を都度作って消す）を、リポジトリに常設のコードとして
置き換えたもの。scripts/e2e/run.sh からのみ使う想定。

Supabase JWTの検証をスキップし、常に固定ユーザー（E2E_USER_ID）として
振る舞う。app.main の FastAPI アプリ自体は一切変更しない
（起動時に dependency_overrides を差し替えているだけ）ので、
通常の起動経路（`app.main:app` / 本番のCMD）には影響しない。

**本番や通常の開発サーバー起動には絶対に使わないこと。**

起動方法:
    uv run uvicorn app.e2e_server:app --host 0.0.0.0 --port 8000
"""

from app.core.auth import CurrentUser, get_current_user
from app.core.e2e import E2E_USER_ID
from app.main import app

_E2E_USER = CurrentUser(
    user_id=E2E_USER_ID,
    email="e2e@example.com",
    display_name="E2E Test User",
    is_admin=False,
)


def _fake_current_user() -> CurrentUser:
    return _E2E_USER


app.dependency_overrides[get_current_user] = _fake_current_user
