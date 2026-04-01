"""Configuration management via environment variables."""
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 6100
    log_level: str = "info"

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"

    # Feature Service (internal Docker network)
    feature_service_url: str = "http://feature-service:5000"
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

    # Session auto-timeout (minutes). 0 = disabled.
    session_max_duration_minutes: int = 240  # 4 hours

    # Profile data auto-cleanup
    profile_max_age_days: int = 30
    profile_cleanup_interval_hours: int = 24

    # WebSocket domain for VNC connections (fallback mode)
    browser_ws_domain: str = "browser.aivalid.id"

    # Streaming mode: "webrtc" or "vnc"
    stream_mode: str = "webrtc"

    # WebRTC settings
    webrtc_video_bitrate: int = 1_500_000   # 1.5 Mbps (safe for QEMU vCPU)
    webrtc_fps: int = 15                    # 15fps — balanced for QEMU without AVX
    webrtc_stun_server: str = "stun:stun.l.google.com:19302"
    webrtc_turn_server: str = "turn:150.241.68.208:3478"
    webrtc_turn_username: str = "aivalid"
    webrtc_turn_password: str = "de4c23a59e1c666cb8e206e583f2a5e3"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

settings = Settings()
