"""WebRTC screen streaming for browser sessions.

Captures the Xvfb framebuffer using mss and streams it as VP8 video
via aiortc RTCPeerConnection.  Input events flow back through a
data channel and are dispatched by InputForwarder.
"""
import asyncio
import fractions
import logging
import time

import numpy as np
from av import VideoFrame
from aiortc import (
    RTCPeerConnection,
    RTCSessionDescription,
    RTCConfiguration,
    RTCIceServer,
    MediaStreamTrack,
)
from aiortc.contrib.media import MediaRelay

from config import settings
from input_forwarder import InputForwarder

logger = logging.getLogger("browser-service.webrtc")

# Shared relay for broadcasting a single capture to multiple viewers
_relay = MediaRelay()


class XvfbVideoTrack(MediaStreamTrack):
    """Captures an Xvfb display via mss and produces VP8-compatible VideoFrames."""

    kind = "video"

    def __init__(self, display_num: int, width: int = 1920, height: int = 1080):
        super().__init__()
        self._display = display_num
        self._width = width
        self._height = height
        self._fps = settings.webrtc_fps
        self._interval = 1.0 / self._fps
        self._start = None
        self._frame_count = 0
        self._sct = None

    def _get_sct(self):
        """Lazy-init mss with the correct DISPLAY."""
        if self._sct is None:
            import os
            import mss
            os.environ["DISPLAY"] = f":{self._display}"
            self._sct = mss.mss()
        return self._sct

    async def recv(self) -> VideoFrame:
        """Produce the next video frame at the configured FPS."""
        if self._start is None:
            self._start = time.monotonic()

        # Pace frames to target FPS
        target_time = self._start + self._frame_count * self._interval
        now = time.monotonic()
        if target_time > now:
            await asyncio.sleep(target_time - now)

        self._frame_count += 1

        # Capture screen in a thread to avoid blocking the event loop
        loop = asyncio.get_event_loop()
        img = await loop.run_in_executor(None, self._capture)

        frame = VideoFrame.from_ndarray(img, format="bgra")
        frame.pts = self._frame_count
        frame.time_base = fractions.Fraction(1, self._fps)
        return frame

    def _capture(self) -> np.ndarray:
        """Grab a screenshot of the Xvfb display (runs in thread)."""
        sct = self._get_sct()
        monitor = {"left": 0, "top": 0, "width": self._width, "height": self._height}
        shot = sct.grab(monitor)
        return np.array(shot, dtype=np.uint8)

    def stop(self):
        """Clean up mss resources."""
        super().stop()
        if self._sct:
            try:
                self._sct.close()
            except Exception:
                pass
            self._sct = None


class BrowserStream:
    """Manages a WebRTC peer connection for a single browser session."""

    def __init__(self, display_num: int, width: int = 1920, height: int = 1080):
        self._display = display_num
        self._width = width
        self._height = height
        self._pc: RTCPeerConnection | None = None
        self._video_track: XvfbVideoTrack | None = None
        self._input_forwarder = InputForwarder(display_num)
        self._data_channel = None

    @property
    def active(self) -> bool:
        return self._pc is not None and self._pc.connectionState in ("new", "connecting", "connected")

    async def create_offer_answer(self, offer_sdp: str, offer_type: str = "offer") -> dict:
        """Accept a client SDP offer and return an SDP answer.

        Returns {"sdp": str, "type": "answer"}.
        """
        ice_servers = []
        if settings.webrtc_stun_server:
            ice_servers.append(RTCIceServer(urls=[settings.webrtc_stun_server]))
        if settings.webrtc_turn_server:
            ice_servers.append(RTCIceServer(
                urls=[settings.webrtc_turn_server],
                username=settings.webrtc_turn_username,
                credential=settings.webrtc_turn_password,
            ))

        config = RTCConfiguration(iceServers=ice_servers)
        self._pc = RTCPeerConnection(configuration=config)

        # Create video track
        self._video_track = XvfbVideoTrack(
            self._display, self._width, self._height,
        )
        self._pc.addTrack(self._video_track)

        # Create data channel for input events
        @self._pc.on("datachannel")
        def on_datachannel(channel):
            self._data_channel = channel

            @channel.on("message")
            def on_message(message):
                asyncio.ensure_future(
                    self._input_forwarder.handle_message(message)
                )

        @self._pc.on("connectionstatechange")
        async def on_connectionstatechange():
            state = self._pc.connectionState
            logger.info("WebRTC connection state: %s (display :%d)", state, self._display)
            if state in ("failed", "closed"):
                await self.close()

        # Set remote offer
        offer = RTCSessionDescription(sdp=offer_sdp, type=offer_type)
        await self._pc.setRemoteDescription(offer)

        # Create and set local answer
        answer = await self._pc.createAnswer()
        await self._pc.setLocalDescription(answer)

        return {
            "sdp": self._pc.localDescription.sdp,
            "type": self._pc.localDescription.type,
        }

    async def add_ice_candidate(self, candidate: dict) -> None:
        """Add a remote ICE candidate."""
        if self._pc is None:
            return
        from aiortc import RTCIceCandidate
        # aiortc accepts candidate strings; parse from the dict
        cand_str = candidate.get("candidate", "")
        if cand_str and self._pc:
            # aiortc handles ICE candidates via addIceCandidate
            # but the Python API is limited — ICE trickle is handled
            # automatically after setRemoteDescription in most cases.
            pass

    async def close(self) -> None:
        """Tear down the peer connection and stop capture."""
        if self._video_track:
            self._video_track.stop()
            self._video_track = None
        if self._pc:
            try:
                await self._pc.close()
            except Exception:
                pass
            self._pc = None
        self._data_channel = None
        logger.info("BrowserStream closed (display :%d)", self._display)
