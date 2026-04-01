"""WebRTC signaling routes for browser sessions."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from auth import UserContext, get_current_user
from session_manager import session_manager

logger = logging.getLogger("browser-service.webrtc-routes")
router = APIRouter()


class SDPOffer(BaseModel):
    sdp: str
    type: str = "offer"


class SDPAnswer(BaseModel):
    sdp: str
    type: str = "answer"


class ICECandidate(BaseModel):
    candidate: str
    sdpMid: str | None = None
    sdpMLineIndex: int | None = None


@router.post("/sessions/{session_id}/offer", response_model=SDPAnswer)
async def webrtc_offer(
    session_id: str,
    offer: SDPOffer,
    user: UserContext = Depends(get_current_user),
):
    """Exchange SDP offer for answer to establish WebRTC connection."""

    session = session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sesi {session_id} tidak ditemukan",
        )

    if session.user_id != user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki akses ke sesi ini",
        )

    if session.webrtc_stream is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sesi ini tidak menggunakan mode WebRTC",
        )

    try:
        answer = await session.webrtc_stream.create_offer_answer(
            offer_sdp=offer.sdp,
            offer_type=offer.type,
        )
    except Exception as e:
        logger.error("WebRTC offer failed for session %s: %s", session_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Gagal membuat koneksi WebRTC",
        )

    return SDPAnswer(sdp=answer["sdp"], type=answer["type"])


@router.post("/sessions/{session_id}/ice")
async def webrtc_ice(
    session_id: str,
    candidate: ICECandidate,
    user: UserContext = Depends(get_current_user),
):
    """Add ICE candidate for WebRTC connection."""

    session = session_manager.get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sesi {session_id} tidak ditemukan",
        )

    if session.user_id != user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki akses ke sesi ini",
        )

    if session.webrtc_stream:
        await session.webrtc_stream.add_ice_candidate(candidate.model_dump())

    return {"status": "ok"}
