"""Input forwarder: translates WebRTC data-channel messages to X11 events.

Uses xdotool to inject mouse/keyboard events into the Xvfb display.
Message format (JSON over data channel):
  {"type": "mousemove", "x": 100, "y": 200}
  {"type": "mousedown", "x": 100, "y": 200, "button": 1}
  {"type": "mouseup",   "x": 100, "y": 200, "button": 1}
  {"type": "click",     "x": 100, "y": 200, "button": 1}
  {"type": "scroll",    "x": 100, "y": 200, "deltaY": -3}
  {"type": "keydown",   "key": "a"}
  {"type": "keyup",     "key": "a"}
  {"type": "keypress",  "key": "Return"}
"""
import asyncio
import json
import logging
import os

logger = logging.getLogger("browser-service.input")

# Browser key names → xdotool key names
KEY_MAP = {
    "Enter": "Return",
    "Backspace": "BackSpace",
    "Tab": "Tab",
    "Escape": "Escape",
    "ArrowLeft": "Left",
    "ArrowRight": "Right",
    "ArrowUp": "Up",
    "ArrowDown": "Down",
    "Delete": "Delete",
    "Home": "Home",
    "End": "End",
    "PageUp": "Prior",
    "PageDown": "Next",
    "Shift": "Shift_L",
    "Control": "Control_L",
    "Alt": "Alt_L",
    "Meta": "Super_L",
    " ": "space",
}

# Mouse button mapping: JS button (0,1,2) → xdotool button (1,2,3)
MOUSE_BUTTON_MAP = {0: 1, 1: 2, 2: 3}


class InputForwarder:
    """Forwards input events to an Xvfb display via xdotool."""

    def __init__(self, display_num: int):
        self._env = {**os.environ, "DISPLAY": f":{display_num}"}
        self._display = display_num

    async def _run(self, *args: str) -> None:
        """Run xdotool command."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "xdotool", *args,
                env=self._env,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.wait(), timeout=2.0)
        except Exception:
            pass  # best-effort, don't crash on input failures

    async def handle_message(self, raw: str) -> None:
        """Parse and dispatch a single data-channel message."""
        try:
            msg = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return

        msg_type = msg.get("type", "")

        if msg_type == "mousemove":
            await self._run("mousemove", str(msg["x"]), str(msg["y"]))

        elif msg_type == "mousedown":
            btn = MOUSE_BUTTON_MAP.get(msg.get("button", 0), 1)
            await self._run("mousemove", str(msg["x"]), str(msg["y"]))
            await self._run("mousedown", str(btn))

        elif msg_type == "mouseup":
            btn = MOUSE_BUTTON_MAP.get(msg.get("button", 0), 1)
            await self._run("mouseup", str(btn))

        elif msg_type == "click":
            btn = MOUSE_BUTTON_MAP.get(msg.get("button", 0), 1)
            await self._run("mousemove", str(msg["x"]), str(msg["y"]))
            await self._run("click", str(btn))

        elif msg_type == "dblclick":
            btn = MOUSE_BUTTON_MAP.get(msg.get("button", 0), 1)
            await self._run("mousemove", str(msg["x"]), str(msg["y"]))
            await self._run("click", "--repeat", "2", "--delay", "50", str(btn))

        elif msg_type == "scroll":
            delta_y = msg.get("deltaY", 0)
            if delta_y > 0:
                clicks = max(1, int(delta_y / 40))
                await self._run("mousemove", str(msg["x"]), str(msg["y"]))
                await self._run("click", "--repeat", str(clicks), "5")  # scroll down
            elif delta_y < 0:
                clicks = max(1, int(abs(delta_y) / 40))
                await self._run("mousemove", str(msg["x"]), str(msg["y"]))
                await self._run("click", "--repeat", str(clicks), "4")  # scroll up

        elif msg_type in ("keydown", "keypress"):
            key = self._translate_key(msg.get("key", ""))
            if key:
                await self._run("key", key)

        elif msg_type == "keyup":
            pass  # xdotool "key" does press+release; we handle on keydown

    def _translate_key(self, key: str) -> str | None:
        """Translate browser key name to xdotool key name."""
        if not key:
            return None
        # Check our map first
        mapped = KEY_MAP.get(key)
        if mapped:
            return mapped
        # Single printable char — xdotool accepts them directly
        if len(key) == 1:
            return key
        # Function keys (F1-F12)
        if key.startswith("F") and key[1:].isdigit():
            return key
        return None
