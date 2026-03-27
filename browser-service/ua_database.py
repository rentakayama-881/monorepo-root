"""Expanded User-Agent database — 50+ realistic browser identities.

Each entry is a complete identity: UA string, platform, vendor, app_version.
Covers Chrome 125-135, Edge 125-135, Brave, across Windows/Mac/Linux.
"""

# Chrome version range — keep updated with stable releases
_CHROME_VERSIONS = [
    "125.0.6422.112", "126.0.6478.127", "127.0.6533.99",
    "128.0.6613.120", "129.0.6668.89", "130.0.6723.70",
    "131.0.6778.86", "132.0.6834.110", "133.0.6917.92",
    "134.0.6998.62", "135.0.7049.52",
]

_EDGE_VERSIONS = [
    "125.0.2535.85", "126.0.2592.81", "127.0.2651.98",
    "128.0.2739.67", "129.0.2792.79", "130.0.2849.68",
    "131.0.2903.86", "132.0.2957.115", "133.0.3065.69",
    "134.0.3124.51", "135.0.3179.42",
]

_BRAVE_VERSIONS = [
    "1.73.97", "1.74.48", "1.75.162",
]


def _chrome_ua(version: str, platform_tag: str) -> str:
    return f"Mozilla/5.0 ({platform_tag}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{version} Safari/537.36"


def _edge_ua(chrome_ver: str, edge_ver: str) -> str:
    return f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chrome_ver} Safari/537.36 Edg/{edge_ver}"


def _brave_ua(chrome_ver: str) -> str:
    return f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chrome_ver} Safari/537.36 Brave/1.73"


def _build_entry(ua: str, platform: str, app_version: str | None = None) -> dict:
    if app_version is None:
        # Strip "Mozilla/" prefix for appVersion
        app_version = ua.replace("Mozilla/", "", 1)
    return {
        "ua": ua,
        "platform": platform,
        "vendor": "Google Inc.",
        "oscpu": "",
        "app_version": app_version,
    }


def _generate_database() -> list[dict]:
    entries = []

    # Chrome Windows (11 versions)
    for v in _CHROME_VERSIONS:
        entries.append(_build_entry(
            _chrome_ua(v, "Windows NT 10.0; Win64; x64"),
            "Win32",
        ))

    # Chrome macOS (11 versions)
    for v in _CHROME_VERSIONS:
        entries.append(_build_entry(
            _chrome_ua(v, "Macintosh; Intel Mac OS X 10_15_7"),
            "MacIntel",
        ))

    # Chrome Linux (6 versions — less common, use newer only)
    for v in _CHROME_VERSIONS[-6:]:
        entries.append(_build_entry(
            _chrome_ua(v, "X11; Linux x86_64"),
            "Linux x86_64",
        ))

    # Edge Windows (11 versions)
    for cv, ev in zip(_CHROME_VERSIONS, _EDGE_VERSIONS):
        entries.append(_build_entry(
            _edge_ua(cv, ev),
            "Win32",
        ))

    # Chrome Windows 11 variant (5 versions)
    for v in _CHROME_VERSIONS[-5:]:
        entries.append(_build_entry(
            _chrome_ua(v, "Windows NT 10.0; Win64; x64"),
            "Win32",
        ))

    # Brave Windows (3 entries)
    for v in _CHROME_VERSIONS[-3:]:
        entries.append(_build_entry(
            _brave_ua(v),
            "Win32",
        ))

    # Chrome macOS Sonoma variant (3 entries)
    for v in _CHROME_VERSIONS[-3:]:
        entries.append(_build_entry(
            _chrome_ua(v, "Macintosh; Intel Mac OS X 14_0"),
            "MacIntel",
        ))

    return entries


# Pre-built database — imported by stealth.py and fingerprint.py
USER_AGENTS = _generate_database()

# GPU renderers — realistic desktop GPU pool
GPU_RENDERERS = [
    {"vendor": "Google Inc. (NVIDIA)", "renderer": "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (NVIDIA)", "renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (NVIDIA)", "renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (NVIDIA)", "renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (NVIDIA)", "renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (AMD)", "renderer": "ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (AMD)", "renderer": "ANGLE (AMD, AMD Radeon RX 6600 XT Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (AMD)", "renderer": "ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (AMD)", "renderer": "ANGLE (AMD, AMD Radeon RX 7600 Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (Intel)", "renderer": "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (Intel)", "renderer": "ANGLE (Intel, Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (Intel)", "renderer": "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (Apple)", "renderer": "ANGLE (Apple, Apple M1, OpenGL 4.1)"},
    {"vendor": "Google Inc. (Apple)", "renderer": "ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)"},
    {"vendor": "Google Inc. (Apple)", "renderer": "ANGLE (Apple, Apple M2, OpenGL 4.1)"},
    {"vendor": "Google Inc. (Apple)", "renderer": "ANGLE (Apple, Apple M3, OpenGL 4.1)"},
]
