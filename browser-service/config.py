"""Configuration management via environment variables."""
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 6100
    log_level: str = "info"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"

    # Feature Service
    feature_service_url: str = "http://127.0.0.1:5000"
    feature_service_token: str = ""

    # Browser limits
    max_concurrent_global: int = 50
    max_concurrent_per_user: int = 2
    vnc_port_range_start: int = 6200
    vnc_port_range_end: int = 6299
    browser_profiles_dir: str = "/opt/alephdraad/browser-service/profiles"
    screenshot_dir: str = "/opt/alephdraad/browser-service/screenshots"

    # Billing
    billing_interval_seconds: int = 60

    # WebSocket domain for VNC connections
    browser_ws_domain: str = "browser.aivalid.id"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

settings = Settings()
