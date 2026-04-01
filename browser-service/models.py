"""Pydantic models for API request/response."""
from pydantic import BaseModel, Field

class StartSessionRequest(BaseModel):
    profile_id: str = Field(..., description="BrowserProfile ID dari Feature Service")
    proxy_server: str | None = Field(None, description="Proxy server URL")
    proxy_username: str | None = None
    proxy_password: str | None = None
    user_agent: str | None = Field(None, description="User-Agent preset")
    fingerprint: dict | None = Field(None, description="Fingerprint config dari profile")

class StartSessionResponse(BaseModel):
    session_id: str
    vnc_ws_url: str | None = Field(None, description="WebSocket URL untuk noVNC (VNC mode)")
    stream_mode: str = Field("vnc", description="'webrtc' or 'vnc'")
    status: str = "starting"

class StopSessionResponse(BaseModel):
    session_id: str
    status: str = "stopped"
    billed_minutes: int = 0

class SessionStatusResponse(BaseModel):
    session_id: str
    status: str
    stream_mode: str = "vnc"
    vnc_ws_url: str | None = None
    started_at: str | None = None
    billed_minutes: int = 0
    total_cost: int = 0

class HealthResponse(BaseModel):
    status: str = "ok"
    active_sessions: int = 0
    max_sessions: int = 50
