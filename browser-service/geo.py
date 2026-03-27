"""Geo-lookup for proxy IPs — auto-detect timezone, locale, and coordinates.

Uses ip-api.com free API (non-commercial, 45 req/min).
Falls back to hardcoded defaults if lookup fails.
"""
import logging
import re
from functools import lru_cache

import httpx

logger = logging.getLogger("browser-service.geo")

# Country code → default language mapping
_COUNTRY_LANGUAGES = {
    "ID": "id-ID", "US": "en-US", "GB": "en-GB", "AU": "en-AU",
    "CA": "en-CA", "JP": "ja-JP", "KR": "ko-KR", "CN": "zh-CN",
    "TW": "zh-TW", "TH": "th-TH", "VN": "vi-VN", "MY": "ms-MY",
    "SG": "en-SG", "PH": "en-PH", "IN": "hi-IN", "DE": "de-DE",
    "FR": "fr-FR", "ES": "es-ES", "IT": "it-IT", "PT": "pt-BR",
    "BR": "pt-BR", "RU": "ru-RU", "NL": "nl-NL", "SE": "sv-SE",
    "NO": "nb-NO", "DK": "da-DK", "FI": "fi-FI", "PL": "pl-PL",
    "TR": "tr-TR", "MX": "es-MX", "AR": "es-AR", "CL": "es-CL",
    "SA": "ar-SA", "AE": "ar-AE", "EG": "ar-EG", "ZA": "en-ZA",
    "NZ": "en-NZ", "IE": "en-IE", "AT": "de-AT", "CH": "de-CH",
    "BE": "nl-BE", "CZ": "cs-CZ", "HU": "hu-HU", "RO": "ro-RO",
    "UA": "uk-UA", "HK": "zh-HK",
}

# Default fallback
_DEFAULT_GEO = {
    "timezone": "Asia/Jakarta",
    "country_code": "ID",
    "language": "id-ID",
    "lat": -6.2088,
    "lng": 106.8456,
    "city": "Jakarta",
}


def _extract_host_from_proxy(proxy_server: str) -> str | None:
    """Extract hostname/IP from proxy URL like socks5://1.2.3.4:1080."""
    match = re.search(r"://([^:/@]+)", proxy_server)
    return match.group(1) if match else None


@lru_cache(maxsize=256)
def _lookup_ip(ip: str) -> dict | None:
    """Query ip-api.com for geo data. Cached to avoid rate limiting."""
    try:
        resp = httpx.get(
            f"http://ip-api.com/json/{ip}",
            params={"fields": "status,countryCode,city,timezone,lat,lon"},
            timeout=5.0,
        )
        data = resp.json()
        if data.get("status") == "success":
            return {
                "timezone": data.get("timezone", ""),
                "country_code": data.get("countryCode", ""),
                "city": data.get("city", ""),
                "lat": data.get("lat", 0),
                "lng": data.get("lon", 0),
            }
    except Exception as e:
        logger.warning("Geo lookup gagal untuk IP %s: %s", ip, e)
    return None


def lookup_proxy_geo(proxy_server: str) -> dict:
    """Look up geo data for a proxy server URL.

    Returns dict with: timezone, country_code, language, lat, lng, city.
    Falls back to Jakarta defaults if lookup fails.
    """
    host = _extract_host_from_proxy(proxy_server)
    if not host:
        logger.warning("Tidak dapat extract host dari proxy: %s", proxy_server)
        return _DEFAULT_GEO.copy()

    geo = _lookup_ip(host)
    if not geo:
        return _DEFAULT_GEO.copy()

    country = geo.get("country_code", "ID")
    language = _COUNTRY_LANGUAGES.get(country, "en-US")

    return {
        "timezone": geo["timezone"] or "Asia/Jakarta",
        "country_code": country,
        "language": language,
        "lat": geo.get("lat", 0),
        "lng": geo.get("lng", 0),
        "city": geo.get("city", ""),
    }
