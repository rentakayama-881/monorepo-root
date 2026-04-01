"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * WebRTCViewer — connects to the browser session via WebRTC.
 *
 * Props:
 *  - sessionId: string
 *  - apiBase: string (browser service base URL)
 *  - token: string (JWT)
 *  - onConnected: () => void
 *  - onDisconnected: () => void
 *  - onFailed: () => void
 */
export default function WebRTCViewer({
  sessionId,
  apiBase,
  token,
  onConnected,
  onDisconnected,
  onFailed,
}) {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const containerRef = useRef(null);
  const [status, setStatus] = useState("connecting");

  // Dimensions of the remote screen (from video metadata)
  const remoteSize = useRef({ width: 1920, height: 1080 });

  // Scale mouse/touch coords from local video element to remote screen
  const scaleCoords = useCallback((clientX, clientY) => {
    const video = videoRef.current;
    if (!video) return { x: 0, y: 0 };
    const rect = video.getBoundingClientRect();

    // Video may have letterboxing (object-fit: contain)
    const videoAspect = remoteSize.current.width / remoteSize.current.height;
    const rectAspect = rect.width / rect.height;

    let renderW, renderH, offsetX, offsetY;
    if (rectAspect > videoAspect) {
      // Letterbox sides
      renderH = rect.height;
      renderW = rect.height * videoAspect;
      offsetX = (rect.width - renderW) / 2;
      offsetY = 0;
    } else {
      // Letterbox top/bottom
      renderW = rect.width;
      renderH = rect.width / videoAspect;
      offsetX = 0;
      offsetY = (rect.height - renderH) / 2;
    }

    const relX = (clientX - rect.left - offsetX) / renderW;
    const relY = (clientY - rect.top - offsetY) / renderH;

    return {
      x: Math.round(Math.max(0, Math.min(1, relX)) * remoteSize.current.width),
      y: Math.round(Math.max(0, Math.min(1, relY)) * remoteSize.current.height),
    };
  }, []);

  // Send input event over data channel
  const sendInput = useCallback((msg) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify(msg));
    }
  }, []);

  // ── Establish WebRTC connection ──
  useEffect(() => {
    if (!sessionId || !apiBase || !token) return;

    let destroyed = false;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:150.241.68.208:3478",
          username: "aivalid",
          credential: "de4c23a59e1c666cb8e206e583f2a5e3",
        },
      ],
    });
    pcRef.current = pc;

    // Receive video track
    pc.ontrack = (event) => {
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    // Create data channel for input
    const dc = pc.createDataChannel("input", { ordered: true });
    dcRef.current = dc;

    dc.onopen = () => {
      if (!destroyed) {
        setStatus("connected");
        onConnected?.();
      }
    };
    dc.onclose = () => {
      if (!destroyed) {
        setStatus("disconnected");
        onDisconnected?.();
      }
    };

    pc.onconnectionstatechange = () => {
      if (destroyed) return;
      const state = pc.connectionState;
      if (state === "connected") {
        setStatus("connected");
        onConnected?.();
      } else if (state === "failed" || state === "closed") {
        setStatus("failed");
        onFailed?.();
      } else if (state === "disconnected") {
        setStatus("disconnected");
        onDisconnected?.();
      }
    };

    // SDP exchange
    async function negotiate() {
      try {
        // Add transceiver for receiving video
        pc.addTransceiver("video", { direction: "recvonly" });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait for ICE gathering to complete (or timeout)
        await new Promise((resolve) => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          } else {
            const check = () => {
              if (pc.iceGatheringState === "complete") {
                pc.removeEventListener("icegatheringstatechange", check);
                resolve();
              }
            };
            pc.addEventListener("icegatheringstatechange", check);
            // Timeout after 5s
            setTimeout(resolve, 5000);
          }
        });

        const res = await fetch(`${apiBase}/api/v1/sessions/${sessionId}/offer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sdp: pc.localDescription.sdp,
            type: pc.localDescription.type,
          }),
        });

        if (!res.ok) {
          throw new Error(`SDP exchange failed: ${res.status}`);
        }

        const answer = await res.json();
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        if (!destroyed) {
          setStatus("failed");
          onFailed?.();
        }
      }
    }

    negotiate();

    return () => {
      destroyed = true;
      dc.close();
      pc.close();
      pcRef.current = null;
      dcRef.current = null;
    };
  }, [sessionId, apiBase, token, onConnected, onDisconnected, onFailed]);

  // ── Mouse event handlers ──
  const handleMouseMove = useCallback((e) => {
    const { x, y } = scaleCoords(e.clientX, e.clientY);
    sendInput({ type: "mousemove", x, y });
  }, [scaleCoords, sendInput]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const { x, y } = scaleCoords(e.clientX, e.clientY);
    sendInput({ type: "mousedown", x, y, button: e.button });
  }, [scaleCoords, sendInput]);

  const handleMouseUp = useCallback((e) => {
    const { x, y } = scaleCoords(e.clientX, e.clientY);
    sendInput({ type: "mouseup", x, y, button: e.button });
  }, [scaleCoords, sendInput]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const { x, y } = scaleCoords(e.clientX, e.clientY);
    sendInput({ type: "scroll", x, y, deltaY: e.deltaY });
  }, [scaleCoords, sendInput]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
  }, []);

  // ── Touch event handlers ──
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const { x, y } = scaleCoords(touch.clientX, touch.clientY);
      sendInput({ type: "mousedown", x, y, button: 0 });
    }
  }, [scaleCoords, sendInput]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const { x, y } = scaleCoords(touch.clientX, touch.clientY);
      sendInput({ type: "mousemove", x, y });
    }
  }, [scaleCoords, sendInput]);

  const handleTouchEnd = useCallback((e) => {
    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const { x, y } = scaleCoords(touch.clientX, touch.clientY);
      sendInput({ type: "mouseup", x, y, button: 0 });
    }
  }, [scaleCoords, sendInput]);

  // ── Keyboard (for desktop users, or when mobile kb is open) ──
  const handleKeyDown = useCallback((e) => {
    e.preventDefault();
    sendInput({ type: "keydown", key: e.key });
  }, [sendInput]);

  const handleKeyUp = useCallback((e) => {
    e.preventDefault();
    sendInput({ type: "keyup", key: e.key });
  }, [sendInput]);

  // Update remote dimensions when video metadata loads
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      remoteSize.current = {
        width: video.videoWidth || 1920,
        height: video.videoHeight || 1080,
      };
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={handleLoadedMetadata}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full h-full object-contain cursor-default"
        style={{ touchAction: "none" }}
      />

      {/* Connecting overlay */}
      {status === "connecting" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center space-y-2">
            <div className="size-8 mx-auto animate-spin rounded-full border-2 border-muted border-t-primary" />
            <p className="text-sm text-white/80">Menghubungkan WebRTC...</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
