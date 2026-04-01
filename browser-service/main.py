"""Smart Browser Service — Cloud Anti-Detect Browser Platform API."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("browser-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    from session_manager import session_manager

    logger.info("Smart Browser Service starting on :%d", settings.port)
    await session_manager.start_watchdog()
    yield
    logger.info("Smart Browser Service shutting down — cleaning up sessions...")
    await session_manager.stop_watchdog()
    await session_manager.cleanup_all()


app = FastAPI(
    title="Smart Browser Service",
    description="Cloud Anti-Detect Browser Platform — Session Management API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://aivalid.id", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and register routes
from routes import router  # noqa: E402
from webrtc_routes import router as webrtc_router  # noqa: E402
app.include_router(router, prefix="/api/v1")
app.include_router(webrtc_router, prefix="/api/v1")


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "browser-service"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
