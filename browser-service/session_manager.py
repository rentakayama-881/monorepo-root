"""Browser session lifecycle manager.

Manages the full lifecycle of cloud browser sessions:
Xvfb (virtual display) → Chromium (Playwright) → x11vnc (VNC) → websockify (WebSocket)
"""
import asyncio
import logging
import os
import signal
from dataclasses import dataclass, field
from pathlib import Path

from config import settings
from geo import lookup_proxy_geo

logger = logging.getLogger("browser-service.session")


@dataclass
class SessionProcess:
    """Tracks all processes for a single browser session."""
    session_id: str
    user_id: int
    profile_id: str
    display_num: int
    vnc_port: int
    ws_port: int
    xvfb_pid: int | None = None
    browser_pid: int | None = None
    vnc_pid: int | None = None
    ws_pid: int | None = None
    playwright_context: object | None = field(default=None, repr=False)


class SessionManager:
    """Manages browser sessions — spawn, track, and cleanup."""

    def __init__(self):
        self._sessions: dict[str, SessionProcess] = {}
        self._port_pool: set[int] = set(
            range(settings.vnc_port_range_start, settings.vnc_port_range_end + 1)
        )
        self._display_counter: int = 100
        self._playwright: object | None = None  # Reusable Playwright instance
        self._watchdog_task: asyncio.Task | None = None

    @property
    def active_count(self) -> int:
        return len(self._sessions)

    def get_session(self, session_id: str) -> SessionProcess | None:
        return self._sessions.get(session_id)

    def get_user_sessions(self, user_id: int) -> list[SessionProcess]:
        return [s for s in self._sessions.values() if s.user_id == user_id]

    # ──────────────────────────────────────────────────────────────────────
    # Process watchdog
    # ──────────────────────────────────────────────────────────────────────

    async def start_watchdog(self) -> None:
        """Start background watchdog that monitors session processes."""
        if self._watchdog_task is None or self._watchdog_task.done():
            self._watchdog_task = asyncio.create_task(self._watchdog_loop())
            logger.info("Process watchdog started")

    async def stop_watchdog(self) -> None:
        """Stop the background watchdog."""
        if self._watchdog_task and not self._watchdog_task.done():
            self._watchdog_task.cancel()
            try:
                await self._watchdog_task
            except asyncio.CancelledError:
                pass
            logger.info("Process watchdog stopped")

    async def _watchdog_loop(self) -> None:
        """Check session processes every 15 seconds. Auto-stop crashed sessions."""
        while True:
            try:
                await asyncio.sleep(15)
                dead_sessions = []
                for sid, session in list(self._sessions.items()):
                    if self._is_session_dead(session):
                        logger.warning(
                            "Watchdog: sesi %s terdeteksi mati — auto-stopping",
                            sid,
                        )
                        dead_sessions.append(sid)

                for sid in dead_sessions:
                    try:
                        await self.stop_session(sid)
                        await self._notify_billing_stop(sid)
                    except Exception as e:
                        logger.error("Watchdog gagal stop sesi %s: %s", sid, e)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Watchdog error: %s", e)

    def _is_session_dead(self, session: SessionProcess) -> bool:
        """Check if critical processes (Xvfb or Chromium) have died."""
        for pid, label in [
            (session.xvfb_pid, "Xvfb"),
            (session.browser_pid, "browser"),
        ]:
            if pid is None:
                continue
            try:
                os.kill(pid, 0)
            except OSError:
                logger.warning("Process %s (PID %d) tidak aktif", label, pid)
                return True
        return False

    async def _notify_billing_stop(self, session_id: str) -> None:
        """Notify Feature Service to stop billing for a crashed session."""
        import httpx
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    f"{settings.feature_service_url}/api/v1/browser/sessions/{session_id}/stop",
                    headers={"X-Service-Token": settings.feature_service_token},
                    json={"reason": "process_crash"},
                )
                logger.info("Billing stop notified for session %s", session_id)
        except Exception as e:
            logger.error("Gagal notify billing stop untuk %s: %s", session_id, e)

    # ──────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ──────────────────────────────────────────────────────────────────────

    async def _get_playwright(self):
        """Get or create a reusable Playwright instance."""
        if self._playwright is None:
            from playwright.async_api import async_playwright
            self._playwright = await async_playwright().start()
        return self._playwright

    async def _kill_process_safe(self, pid: int | None, label: str = "") -> None:
        """Terminate a process safely: SIGTERM → wait 3s → SIGKILL if still alive."""
        if pid is None:
            return

        # Check if process is still running
        try:
            os.kill(pid, 0)
        except OSError:
            logger.debug("Proses %s (PID %d) sudah tidak aktif", label, pid)
            return

        # Send SIGTERM
        try:
            os.kill(pid, signal.SIGTERM)
            logger.debug("SIGTERM dikirim ke %s (PID %d)", label, pid)
        except OSError:
            return

        # Wait up to 3 seconds for graceful exit
        for _ in range(30):
            await asyncio.sleep(0.1)
            try:
                os.kill(pid, 0)
            except OSError:
                logger.debug("Proses %s (PID %d) berhasil dihentikan", label, pid)
                return

        # Force kill — process did not respond to SIGTERM
        try:
            os.kill(pid, signal.SIGKILL)
            logger.warning(
                "SIGKILL dikirim ke %s (PID %d) — tidak merespons SIGTERM",
                label, pid,
            )
        except OSError:
            pass

    # ──────────────────────────────────────────────────────────────────────
    # Proxy health check
    # ──────────────────────────────────────────────────────────────────────

    async def _check_proxy(self, proxy_settings: dict) -> dict:
        """Test proxy reachability. Returns {ok, external_ip, latency_ms, error}."""
        import httpx
        import time

        server = proxy_settings.get("server", "")
        username = proxy_settings.get("username")
        password = proxy_settings.get("password")

        # Build proxy URL with auth
        if username and password:
            # Insert auth into proxy URL: socks5://user:pass@host:port
            proxy_url = server.replace("://", f"://{username}:{password}@", 1)
        else:
            proxy_url = server

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(
                proxy=proxy_url,
                timeout=10.0,
                verify=False,
            ) as client:
                resp = await client.get("https://httpbin.org/ip")
                latency = int((time.monotonic() - start) * 1000)
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "ok": True,
                        "external_ip": data.get("origin", ""),
                        "latency_ms": latency,
                        "error": None,
                    }
                return {
                    "ok": False,
                    "external_ip": "",
                    "latency_ms": latency,
                    "error": f"Proxy returned HTTP {resp.status_code}",
                }
        except httpx.ProxyError as e:
            return {"ok": False, "external_ip": "", "latency_ms": 0,
                    "error": f"Proxy authentication gagal: {e}"}
        except (httpx.ConnectError, httpx.ConnectTimeout) as e:
            return {"ok": False, "external_ip": "", "latency_ms": 0,
                    "error": f"Proxy tidak dapat dijangkau: {e}"}
        except Exception as e:
            return {"ok": False, "external_ip": "", "latency_ms": 0,
                    "error": f"Proxy check gagal: {e}"}

    # ──────────────────────────────────────────────────────────────────────
    # Session lifecycle
    # ──────────────────────────────────────────────────────────────────────

    async def start_session(
        self,
        session_id: str,
        user_id: int,
        profile_id: str,
        user_data_dir: str,
        user_agent: str | None = None,
        proxy_settings: dict | None = None,
        fingerprint: dict | None = None,
    ) -> SessionProcess:
        """Start a full browser session stack.

        Steps:
        1. Allocate VNC port + display number
        2. Start Xvfb virtual display
        3. Launch Chromium via Playwright with stealth injection
        4. Start x11vnc on the display
        5. Start websockify (VNC→WebSocket bridge)
        """
        # ── 0. Pre-flight proxy check ─────────────────────────────────
        if proxy_settings:
            proxy_result = await self._check_proxy(proxy_settings)
            if not proxy_result["ok"]:
                raise RuntimeError(
                    f"Proxy tidak dapat digunakan: {proxy_result['error']}"
                )
            logger.info(
                "Proxy OK — external IP: %s, latency: %dms",
                proxy_result.get("external_ip", "?"),
                proxy_result.get("latency_ms", 0),
            )

        # ── 1. Allocate resources ──────────────────────────────────────
        vnc_port = self._allocate_port()
        ws_port = vnc_port + 100  # e.g., VNC 6200 → WS 6300
        display_num = self._next_display()

        # Track sub-processes for rollback on failure
        xvfb_proc = None
        vnc_proc = None
        ws_proc = None
        context = None

        try:
            # ── 2. Start Xvfb ─────────────────────────────────────────
            width = fingerprint.get("screenWidth", 1920) if fingerprint else 1920
            height = fingerprint.get("screenHeight", 1080) if fingerprint else 1080
            color_depth = fingerprint.get("colorDepth", 24) if fingerprint else 24

            xvfb_cmd = [
                "Xvfb", f":{display_num}",
                "-screen", "0", f"{width}x{height}x{color_depth}",
                "-ac",              # disable access control
                "-nolisten", "tcp",
            ]
            logger.info(
                "Memulai Xvfb di display :%d (%dx%dx%d)",
                display_num, width, height, color_depth,
            )
            xvfb_proc = await asyncio.create_subprocess_exec(
                *xvfb_cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            # Give Xvfb time to initialise the display
            await asyncio.sleep(0.5)

            if xvfb_proc.returncode is not None:
                raise RuntimeError(
                    f"Xvfb gagal dimulai (exit code: {xvfb_proc.returncode})"
                )

            # ── 3. Set DISPLAY & launch Chromium via Playwright ───────
            os.environ["DISPLAY"] = f":{display_num}"

            from stealth import (
                build_stealth_script,
                profile_seed,
                get_navigator_overrides,
                GPU_RENDERERS,
                USER_AGENTS,
                STEALTH_CHROMIUM_ARGS,
            )

            # Ensure user_data_dir exists
            Path(user_data_dir).mkdir(parents=True, exist_ok=True)

            seed = profile_seed(user_data_dir)
            nav_overrides = get_navigator_overrides(user_agent or "")
            gpu = GPU_RENDERERS[seed % len(GPU_RENDERERS)]
            identity = USER_AGENTS[seed % len(USER_AGENTS)]

            # Auto-detect geo from proxy if available
            if proxy_settings:
                geo = lookup_proxy_geo(proxy_settings["server"])
                logger.info("Proxy geo: %s (%s)", geo.get("city", "?"), geo.get("country_code", "?"))
            else:
                geo = None

            # Derive timezone and languages — proxy geo overrides fingerprint
            if geo and geo.get("timezone"):
                tz = geo["timezone"]
                lang = geo.get("language", "id-ID")
            else:
                tz = fingerprint.get("timezone", "Asia/Jakarta") if fingerprint else "Asia/Jakarta"
                lang = fingerprint.get("language", "id-ID") if fingerprint else "id-ID"

            lang_base = lang.split("-")[0]  # "id-ID" → "id"
            languages = [lang, lang_base] if lang_base != lang else [lang]
            if "en" not in lang_base:
                languages += ["en-US", "en"]

            stealth_js = build_stealth_script(
                seed, nav_overrides, identity, gpu,
                timezone=tz, languages=languages,
            )

            pw = await self._get_playwright()

            launch_kwargs: dict = dict(
                user_data_dir=user_data_dir,
                headless=False,         # headed mode for VNC viewing
                accept_downloads=True,
                args=STEALTH_CHROMIUM_ARGS + [f"--lang={lang}"],
            )

            # Apply context settings from resolved geo/fingerprint
            launch_kwargs["timezone_id"] = tz
            launch_kwargs["locale"] = lang
            if geo and geo.get("lat"):
                launch_kwargs["geolocation"] = {
                    "latitude": geo["lat"],
                    "longitude": geo["lng"],
                    "accuracy": 100,
                }
                launch_kwargs["permissions"] = ["geolocation"]

            if user_agent:
                launch_kwargs["user_agent"] = user_agent
            if proxy_settings:
                proxy: dict = {"server": proxy_settings["server"]}
                if "username" in proxy_settings:
                    proxy["username"] = proxy_settings["username"]
                if "password" in proxy_settings:
                    proxy["password"] = proxy_settings["password"]
                launch_kwargs["proxy"] = proxy

            logger.info(
                "Meluncurkan Chromium untuk sesi %s (profile: %s)",
                session_id, profile_id,
            )
            context = await pw.chromium.launch_persistent_context(**launch_kwargs)
            await context.add_init_script(stealth_js)

            # Open initial page
            page = context.pages[0] if context.pages else await context.new_page()
            await page.goto("about:blank")

            # Try to capture browser PID (best-effort)
            browser_pid: int | None = None
            try:
                if hasattr(context, "browser") and context.browser:
                    proc = getattr(context.browser, "process", None)
                    if proc:
                        browser_pid = proc.pid
            except Exception:
                pass

            # ── 4. Start x11vnc ───────────────────────────────────────
            vnc_cmd = [
                "x11vnc",
                "-display", f":{display_num}",
                "-rfbport", str(vnc_port),
                "-shared",          # allow multiple connections
                "-forever",         # don't exit after first client disconnect
                "-nopw",            # no password (auth via WebSocket layer)
                "-noxdamage",       # better compatibility
                "-cursor", "most",
                "-noscr",           # disable scrollcopyrect
                "-nowf",            # disable wireframe
            ]
            logger.info(
                "Memulai x11vnc di port %d untuk display :%d",
                vnc_port, display_num,
            )
            vnc_proc = await asyncio.create_subprocess_exec(
                *vnc_cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.sleep(0.5)

            if vnc_proc.returncode is not None:
                raise RuntimeError(
                    f"x11vnc gagal dimulai (exit code: {vnc_proc.returncode})"
                )

            # ── 5. Start websockify ───────────────────────────────────
            ws_cmd = [
                "websockify",
                "--web", "/usr/share/novnc",
                str(ws_port),
                f"localhost:{vnc_port}",
            ]
            logger.info(
                "Memulai websockify di port %d → VNC port %d",
                ws_port, vnc_port,
            )
            ws_proc = await asyncio.create_subprocess_exec(
                *ws_cmd,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.sleep(0.3)

            if ws_proc.returncode is not None:
                raise RuntimeError(
                    f"websockify gagal dimulai (exit code: {ws_proc.returncode})"
                )

            # ── 6. Track session ──────────────────────────────────────
            session = SessionProcess(
                session_id=session_id,
                user_id=user_id,
                profile_id=profile_id,
                display_num=display_num,
                vnc_port=vnc_port,
                ws_port=ws_port,
                xvfb_pid=xvfb_proc.pid,
                browser_pid=browser_pid,
                vnc_pid=vnc_proc.pid,
                ws_pid=ws_proc.pid,
                playwright_context=context,
            )
            self._sessions[session_id] = session

            logger.info(
                "Sesi %s berhasil dimulai — VNC: %d, WS: %d, display: :%d",
                session_id, vnc_port, ws_port, display_num,
            )
            return session

        except Exception as exc:
            # ── Rollback: clean up everything that was started ────────
            logger.error(
                "Gagal memulai sesi %s: %s — melakukan rollback",
                session_id, exc,
            )

            if context:
                try:
                    await context.close()
                except Exception:
                    pass

            if ws_proc and ws_proc.returncode is None:
                await self._kill_process_safe(ws_proc.pid, "websockify")
            if vnc_proc and vnc_proc.returncode is None:
                await self._kill_process_safe(vnc_proc.pid, "x11vnc")
            if xvfb_proc and xvfb_proc.returncode is None:
                await self._kill_process_safe(xvfb_proc.pid, "Xvfb")

            self._release_port(vnc_port)
            raise RuntimeError(f"Gagal memulai sesi browser: {exc}") from exc

    async def stop_session(self, session_id: str) -> None:
        """Gracefully stop a browser session and cleanup all processes."""
        session = self._sessions.get(session_id)
        if session is None:
            raise KeyError(f"Sesi {session_id} tidak ditemukan")

        logger.info("Menghentikan sesi %s...", session_id)

        # 1. Close Playwright context gracefully
        if session.playwright_context:
            try:
                await session.playwright_context.close()
                logger.debug(
                    "Playwright context untuk sesi %s berhasil ditutup", session_id,
                )
            except Exception as e:
                logger.warning(
                    "Gagal menutup Playwright context sesi %s: %s", session_id, e,
                )

        # 2. Kill processes in reverse order: websockify → x11vnc → browser → Xvfb
        await self._kill_process_safe(session.ws_pid, f"websockify[{session_id}]")
        await self._kill_process_safe(session.vnc_pid, f"x11vnc[{session_id}]")
        await self._kill_process_safe(session.browser_pid, f"browser[{session_id}]")
        await self._kill_process_safe(session.xvfb_pid, f"Xvfb[{session_id}]")

        # 3. Brief wait for OS-level cleanup
        await asyncio.sleep(0.2)

        # 4. Release port back to the pool
        self._release_port(session.vnc_port)

        # 5. Remove from sessions dict
        del self._sessions[session_id]
        logger.info("Sesi %s berhasil dihentikan", session_id)

    async def cleanup_all(self) -> None:
        """Stop all active sessions — called on service shutdown."""
        if not self._sessions:
            logger.info("Tidak ada sesi aktif yang perlu dibersihkan")
            return

        logger.info("Membersihkan %d sesi aktif...", len(self._sessions))
        for session_id in list(self._sessions.keys()):
            try:
                await self.stop_session(session_id)
            except Exception as e:
                logger.error("Gagal membersihkan sesi %s: %s", session_id, e)

        # Shutdown the shared Playwright instance
        if self._playwright:
            try:
                await self._playwright.stop()
                self._playwright = None
                logger.info("Playwright instance berhasil dihentikan")
            except Exception as e:
                logger.warning("Gagal menghentikan Playwright: %s", e)

    # ──────────────────────────────────────────────────────────────────────
    # Port & display allocation
    # ──────────────────────────────────────────────────────────────────────

    def _allocate_port(self) -> int:
        """Allocate an available VNC port."""
        if not self._port_pool:
            raise RuntimeError("Semua port VNC sudah terpakai — server penuh")
        return self._port_pool.pop()

    def _release_port(self, port: int) -> None:
        """Return a VNC port to the pool."""
        self._port_pool.add(port)

    def _next_display(self) -> int:
        """Get next available X display number."""
        self._display_counter += 1
        return self._display_counter


# Singleton instance
session_manager = SessionManager()
