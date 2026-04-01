"""API routes for browser session management."""
import logging
import os
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status

from auth import UserContext, get_current_user
from config import settings
from models import (
    StartSessionRequest,
    StartSessionResponse,
    StopSessionResponse,
    SessionStatusResponse,
    HealthResponse,
)
from session_manager import session_manager

logger = logging.getLogger("browser-service.routes")
router = APIRouter()


async def _fetch_profile_proxy(profile_id: str, auth_header: str) -> dict | None:
    """Fetch proxy settings from Feature Service for a profile."""
    url = f"{settings.feature_service_url}/api/v1/browser/profiles/{profile_id}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers={"Authorization": auth_header})
            if resp.status_code != 200:
                logger.warning("Feature-service profile fetch failed: %s", resp.status_code)
                return None
            data = resp.json()
            proxy_server = data.get("proxyServer") or data.get("proxy_server")
            if not proxy_server:
                return None
            proxy = {"server": proxy_server}
            proxy_user = data.get("proxyUsername") or data.get("proxy_username")
            proxy_pass = data.get("proxyPassword") or data.get("proxy_password")
            if proxy_user:
                proxy["username"] = proxy_user
            if proxy_pass:
                proxy["password"] = proxy_pass
            return proxy
    except Exception as e:
        logger.error("Failed to fetch profile from feature-service: %s", e)
        return None


@router.post("/sessions/start", response_model=StartSessionResponse)
async def start_session(
    request: StartSessionRequest,
    raw_request: Request,
    user: UserContext = Depends(get_current_user),
):
    """Start a new browser session from a profile."""

    # 1. Check global capacity
    if session_manager.active_count >= settings.max_concurrent_global:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server sedang penuh — coba lagi nanti",
        )

    # 2. Check per-user concurrent limit
    user_sessions = session_manager.get_user_sessions(user.user_id)
    if len(user_sessions) >= settings.max_concurrent_per_user:
        # Return active session IDs so client can redirect instead of showing error
        active_ids = [s.session_id for s in user_sessions]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Anda sudah mencapai batas maksimal sesi aktif",
                "active_session_ids": active_ids,
            },
        )

    # 3. Generate session ID
    session_id = f"bsn_{uuid.uuid4().hex[:20]}"

    # 4. Build profile directory path
    profile_dir = os.path.join(settings.browser_profiles_dir, request.profile_id)

    # 5. Fetch proxy from Feature Service using user's token
    auth_header = raw_request.headers.get("authorization", "")
    proxy = await _fetch_profile_proxy(request.profile_id, auth_header)
    if proxy:
        logger.info("Proxy loaded for profile %s: %s", request.profile_id, proxy["server"])
    else:
        logger.info("No proxy for profile %s", request.profile_id)

    # 6. Start session via session manager
    try:
        session = await session_manager.start_session(
            session_id=session_id,
            user_id=user.user_id,
            profile_id=request.profile_id,
            user_data_dir=profile_dir,
            user_agent=request.user_agent,
            proxy_settings=proxy,
            fingerprint=request.fingerprint,
        )
    except RuntimeError as e:
        logger.error("Gagal memulai sesi untuk user %s: %s", user.user_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    # 7. Build response based on stream mode
    vnc_ws_url = None
    if session.stream_mode == "vnc":
        vnc_ws_url = f"wss://{settings.browser_ws_domain}/ws/{session.ws_port}"

    return StartSessionResponse(
        session_id=session_id,
        vnc_ws_url=vnc_ws_url,
        stream_mode=session.stream_mode,
        status="active",
        started_at=session.started_at_utc,
    )


@router.post("/sessions/{session_id}/stop", response_model=StopSessionResponse)
async def stop_session(
    session_id: str,
    user: UserContext = Depends(get_current_user),
):
    """Stop an active browser session."""

    # Verify session exists
    session = session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sesi {session_id} tidak ditemukan",
        )

    # Verify ownership — user can only stop their own sessions
    if session.user_id != user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki akses ke sesi ini",
        )

    try:
        await session_manager.stop_session(session_id)
    except Exception as e:
        logger.error("Gagal menghentikan sesi %s: %s", session_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gagal menghentikan sesi: {e}",
        )

    return StopSessionResponse(
        session_id=session_id,
        status="stopped",
    )


@router.get("/sessions/{session_id}/status", response_model=SessionStatusResponse)
async def get_session_status(
    session_id: str,
    user: UserContext = Depends(get_current_user),
):
    """Get current status of a browser session."""

    session = session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sesi {session_id} tidak ditemukan",
        )

    # Verify ownership
    if session.user_id != user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki akses ke sesi ini",
        )

    vnc_ws_url = None
    if session.stream_mode == "vnc":
        vnc_ws_url = f"wss://{settings.browser_ws_domain}/ws/{session.ws_port}"

    return SessionStatusResponse(
        session_id=session_id,
        status="active",
        stream_mode=session.stream_mode,
        vnc_ws_url=vnc_ws_url,
        started_at=session.started_at_utc,
    )
