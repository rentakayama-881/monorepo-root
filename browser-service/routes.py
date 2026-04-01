"""API routes for browser session management."""
import logging
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, status

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


@router.post("/sessions/start", response_model=StartSessionResponse)
async def start_session(
    request: StartSessionRequest,
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

    # 5. Build proxy settings dict (if provided)
    proxy = None
    if request.proxy_server:
        proxy = {"server": request.proxy_server}
        if request.proxy_username:
            proxy["username"] = request.proxy_username
        if request.proxy_password:
            proxy["password"] = request.proxy_password

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
    )
