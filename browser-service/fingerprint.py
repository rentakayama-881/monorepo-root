"""Auto-generate browser fingerprint for profiles."""
import hashlib
import random
from ua_database import USER_AGENTS, GPU_RENDERERS

SCREEN_RESOLUTIONS = [
    (1920, 1080), (1366, 768), (1536, 864), (1440, 900),
    (1280, 720), (1600, 900), (2560, 1440), (1680, 1050),
]

TIMEZONES = [
    "Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura",
    "America/New_York", "Europe/London", "Asia/Tokyo",
    "Asia/Singapore", "Australia/Sydney",
]

LANGUAGES = ["id-ID", "en-US", "en-GB", "ja-JP", "zh-CN"]

def generate_fingerprint(profile_id: str) -> dict:
    """Generate deterministic fingerprint dari profile ID."""
    seed = int(hashlib.sha256(profile_id.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)

    ua = rng.choice(USER_AGENTS)
    gpu = GPU_RENDERERS[seed % len(GPU_RENDERERS)]
    resolution = rng.choice(SCREEN_RESOLUTIONS)

    return {
        "userAgentPreset": ua["ua"],
        "gpuVendor": gpu["vendor"],
        "gpuRenderer": gpu["renderer"],
        "screenWidth": resolution[0],
        "screenHeight": resolution[1],
        "colorDepth": rng.choice([24, 32]),
        "platform": ua["platform"],
        "timezone": rng.choice(TIMEZONES),
        "language": rng.choice(LANGUAGES),
    }
