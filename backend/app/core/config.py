from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    database_url: str
    supabase_url: str
    cors_origins: str  # カンマ区切り（例: "https://example.com,http://localhost:5173"）
    app_url: str       # アプリの公開URL（プライバシーポリシー等で使用）


settings = Settings()  # type: ignore[call-arg]
