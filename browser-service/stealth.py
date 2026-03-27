"""Anti-fingerprinting / stealth module for browser sessions.

Extracted from browser-manager/main.py — constants, helpers, and the full
stealth JavaScript builder used to inject anti-detection measures into
every Chromium page context.
"""
import hashlib

# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

USER_AGENTS = [
    {
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "platform": "Win32",
        "vendor": "Google Inc.",
        "oscpu": "",
        "app_version": "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    {
        "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "platform": "MacIntel",
        "vendor": "Google Inc.",
        "oscpu": "",
        "app_version": "5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    {
        "ua": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "platform": "Linux x86_64",
        "vendor": "Google Inc.",
        "oscpu": "",
        "app_version": "5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    {
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
        "platform": "Win32",
        "vendor": "Google Inc.",
        "oscpu": "",
        "app_version": "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
    },
]

GPU_RENDERERS = [
    {"vendor": "Google Inc. (NVIDIA)", "renderer": "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (NVIDIA)", "renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (AMD)", "renderer": "ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (Intel)", "renderer": "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (Apple)", "renderer": "ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)"},
    {"vendor": "Google Inc. (NVIDIA)", "renderer": "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (Intel)", "renderer": "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)"},
    {"vendor": "Google Inc. (AMD)", "renderer": "ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)"},
]

STEALTH_CHROMIUM_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-infobars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
]

# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────


def profile_seed(user_data_dir: str) -> int:
    """Generate deterministic integer seed dari user_data_dir path."""
    return int(hashlib.sha256(user_data_dir.encode()).hexdigest()[:8], 16)


def get_navigator_overrides(user_agent: str) -> dict[str, str]:
    """Mapping UA string → navigator properties yang konsisten."""
    ua_lower = user_agent.lower()

    if "macintosh" in ua_lower or "mac os" in ua_lower:
        platform = "MacIntel"
    elif "linux" in ua_lower and "android" not in ua_lower:
        platform = "Linux x86_64"
    else:
        platform = "Win32"

    vendor = "" if "firefox" in ua_lower else "Google Inc."

    return {"platform": platform, "vendor": vendor}


# ──────────────────────────────────────────────────────────────────────────────
# Stealth JavaScript Builder
# ──────────────────────────────────────────────────────────────────────────────


def build_stealth_script(
    seed: int,
    nav_overrides: dict[str, str],
    identity: dict[str, str],
    gpu: dict[str, str],
) -> str:
    """
    Generate unified stealth JavaScript — single IIFE yang mencakup semua hooking.

    Teknik:
    1. Proxy wrapper untuk navigator (lolos Object.getOwnPropertyDescriptor check)
    2. toString() spoofing agar semua override tampak [native code]
    3. Canvas noise (toDataURL, getImageData)
    4. WebGL parameter spoof (UNMASKED_RENDERER/VENDOR)
    5. AudioContext noise (getFloatFrequencyData, getChannelData)
    6. ClientRects noise (getBoundingClientRect, getClientRects)
    7. Deep webdriver deletion + CDC marker cleanup
    8. Runtime.enable interception
    """
    return f"""(() => {{
    'use strict';

    // ═══ PRNG (mulberry32) — deterministic per profile ═══
    const _seed = {seed};
    const createPRNG = (s) => () => {{
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }};
    const prng = createPRNG(_seed);

    // ═══ UTILITY: native toString spoofing ═══
    const nativize = (fn, name) => {{
        const str = 'function ' + name + '() {{ [native code] }}';
        fn.toString = () => str;
        if (fn[Symbol.hasInstance]) fn[Symbol.hasInstance].toString = () => str;
        return fn;
    }};

    // ═══ 1. NAVIGATOR PROXY WRAPPER ═══
    // Menggunakan Proxy agar Object.getOwnPropertyDescriptor(navigator, 'platform')
    // return undefined (sama seperti browser asli — property ada di prototype)
    const navOverrides = {{
        platform: '{nav_overrides["platform"]}',
        vendor: '{nav_overrides["vendor"]}',
        appVersion: '{identity["app_version"]}',
        userAgent: '{identity["ua"]}',
        hardwareConcurrency: Math.max(2, Math.floor(prng() * 12) + 2),
        deviceMemory: [2, 4, 8, 16][Math.floor(prng() * 4)],
        maxTouchPoints: 0,
        languages: ['en-US', 'en'],
    }};

    const navigatorHandler = {{
        get(target, prop, receiver) {{
            if (prop in navOverrides) return navOverrides[prop];
            const val = Reflect.get(target, prop, receiver);
            return typeof val === 'function' ? val.bind(target) : val;
        }},
        getOwnPropertyDescriptor(target, prop) {{
            // Return undefined untuk overridden props agar tampak sebagai inherited
            if (prop in navOverrides) return undefined;
            return Reflect.getOwnPropertyDescriptor(target, prop);
        }},
        has(target, prop) {{
            if (prop in navOverrides) return true;
            return Reflect.has(target, prop);
        }},
    }};

    try {{
        // Proxy pada window.navigator
        const proxiedNav = new Proxy(navigator, navigatorHandler);
        Object.defineProperty(window, 'navigator', {{
            get: () => proxiedNav,
            configurable: true,
        }});
    }} catch(e) {{}}

    // ═══ 2. WEBDRIVER DEEP DELETE + CDC CLEANUP ═══
    try {{
        // Deep delete webdriver dari prototype chain
        const proto = Object.getPrototypeOf(navigator);
        if ('webdriver' in proto) {{
            delete proto.webdriver;
        }}
        // Fallback: override pada Navigator.prototype
        Object.defineProperty(Navigator.prototype, 'webdriver', {{
            get: nativize(() => undefined, 'get webdriver'),
            configurable: true,
        }});
    }} catch(e) {{}}

    // Hapus CDC (Chrome DevTools) markers
    try {{
        for (const prop of Object.getOwnPropertyNames(window)) {{
            if (prop.match(/^cdc_/i) || prop.match(/^\\$cdc_/i)) {{
                delete window[prop];
            }}
        }}
        // Hapus juga dari document
        for (const prop of Object.getOwnPropertyNames(document)) {{
            if (prop.match(/^cdc_/i) || prop.match(/^\\$cdc_/i)) {{
                delete document[prop];
            }}
        }}
    }} catch(e) {{}}

    // ═══ 3. RUNTIME.ENABLE INTERCEPTION ═══
    // Prevent automation detection via Chrome DevTools Protocol leak
    try {{
        const origCall = Function.prototype.call;
        const origApply = Function.prototype.apply;

        // Block stacktrace-based detection
        if (window.Error) {{
            const origStack = Object.getOwnPropertyDescriptor(Error.prototype, 'stack');
            if (origStack && origStack.get) {{
                const origGetter = origStack.get;
                Object.defineProperty(Error.prototype, 'stack', {{
                    get() {{
                        const stack = origGetter.call(this);
                        if (typeof stack === 'string') {{
                            return stack
                                .replace(/\\n.*playwright.*$/gm, '')
                                .replace(/\\n.*puppeteer.*$/gm, '')
                                .replace(/\\n.*__playwright.*$/gm, '');
                        }}
                        return stack;
                    }},
                    configurable: true,
                }});
            }}
        }}
    }} catch(e) {{}}

    // ═══ 4. CANVAS NOISE ═══
    const addCanvasNoise = (imageData) => {{
        const pixels = imageData.data;
        const count = Math.max(1, Math.floor(pixels.length / 4 * 0.02));
        for (let i = 0; i < count; i++) {{
            const idx = Math.floor(prng() * (pixels.length / 4)) * 4;
            const ch = Math.floor(prng() * 3);
            const delta = prng() > 0.5 ? 1 : -1;
            pixels[idx + ch] = Math.max(0, Math.min(255, pixels[idx + ch] + delta));
        }}
    }};

    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = nativize(function(...args) {{
        try {{
            const ctx = this.getContext('2d');
            if (ctx && this.width > 0 && this.height > 0) {{
                const img = ctx.getImageData(0, 0, this.width, this.height);
                addCanvasNoise(img);
                ctx.putImageData(img, 0, 0);
            }}
        }} catch(e) {{}}
        return origToDataURL.apply(this, args);
    }}, 'toDataURL');

    const origToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = nativize(function(...args) {{
        try {{
            const ctx = this.getContext('2d');
            if (ctx && this.width > 0 && this.height > 0) {{
                const img = ctx.getImageData(0, 0, this.width, this.height);
                addCanvasNoise(img);
                ctx.putImageData(img, 0, 0);
            }}
        }} catch(e) {{}}
        return origToBlob.apply(this, args);
    }}, 'toBlob');

    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = nativize(function(...args) {{
        const imageData = origGetImageData.apply(this, args);
        try {{ addCanvasNoise(imageData); }} catch(e) {{}}
        return imageData;
    }}, 'getImageData');

    // ═══ 5. WEBGL PARAMETER SPOOF ═══
    const UNMASKED_VENDOR = 0x9245;
    const UNMASKED_RENDERER = 0x9246;
    const gpuVendor = '{gpu["vendor"]}';
    const gpuRenderer = '{gpu["renderer"]}';

    const spoofGL = (Proto) => {{
        if (typeof Proto === 'undefined') return;
        const origGetParam = Proto.prototype.getParameter;
        Proto.prototype.getParameter = nativize(function(param) {{
            if (param === UNMASKED_VENDOR) return gpuVendor;
            if (param === UNMASKED_RENDERER) return gpuRenderer;
            return origGetParam.call(this, param);
        }}, 'getParameter');
    }};

    if (typeof WebGLRenderingContext !== 'undefined') spoofGL(WebGLRenderingContext);
    if (typeof WebGL2RenderingContext !== 'undefined') spoofGL(WebGL2RenderingContext);

    // ═══ 6. AUDIOCTX FINGERPRINT NOISE ═══
    if (typeof AudioBuffer !== 'undefined') {{
        const origGetChannelData = AudioBuffer.prototype.getChannelData;
        AudioBuffer.prototype.getChannelData = nativize(function(channel) {{
            const data = origGetChannelData.call(this, channel);
            // Noise ~0.01% samples with ±1e-7 (inaudible)
            const count = Math.max(1, Math.floor(data.length * 0.0001));
            for (let i = 0; i < count; i++) {{
                const idx = Math.floor(prng() * data.length);
                data[idx] += (prng() - 0.5) * 2e-7;
            }}
            return data;
        }}, 'getChannelData');
    }}

    if (typeof AnalyserNode !== 'undefined') {{
        const origGetFloat = AnalyserNode.prototype.getFloatFrequencyData;
        AnalyserNode.prototype.getFloatFrequencyData = nativize(function(array) {{
            origGetFloat.call(this, array);
            const count = Math.max(1, Math.floor(array.length * 0.001));
            for (let i = 0; i < count; i++) {{
                const idx = Math.floor(prng() * array.length);
                array[idx] += (prng() - 0.5) * 0.01;
            }}
        }}, 'getFloatFrequencyData');
    }}

    // ═══ 7. CLIENT RECTS NOISE ═══
    const noiseRect = (rect) => {{
        const noise = () => (prng() - 0.5) * 0.01; // ±0.005px
        return new DOMRect(
            rect.x + noise(),
            rect.y + noise(),
            rect.width + noise(),
            rect.height + noise()
        );
    }};

    const origGetBCR = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = nativize(function() {{
        const rect = origGetBCR.call(this);
        return noiseRect(rect);
    }}, 'getBoundingClientRect');

    const origGetCR = Element.prototype.getClientRects;
    Element.prototype.getClientRects = nativize(function() {{
        const rects = origGetCR.call(this);
        const result = [];
        for (let i = 0; i < rects.length; i++) {{
            result.push(noiseRect(rects[i]));
        }}
        // Mimic DOMRectList interface
        result.item = (idx) => result[idx] || null;
        return result;
    }}, 'getClientRects');

    // ═══ 8. SCREEN PROXY ═══
    try {{
        const screenOverrides = {{
            width: [1920, 2560, 1440, 1680][Math.floor(prng() * 4)],
            height: [1080, 1440, 900, 1050][Math.floor(prng() * 4)],
            colorDepth: 24,
            pixelDepth: 24,
        }};
        screenOverrides.availWidth = screenOverrides.width;
        screenOverrides.availHeight = screenOverrides.height - (prng() > 0.5 ? 40 : 30);

        const screenHandler = {{
            get(target, prop, receiver) {{
                if (prop in screenOverrides) return screenOverrides[prop];
                const val = Reflect.get(target, prop, receiver);
                return typeof val === 'function' ? val.bind(target) : val;
            }},
            getOwnPropertyDescriptor(target, prop) {{
                if (prop in screenOverrides) return undefined;
                return Reflect.getOwnPropertyDescriptor(target, prop);
            }},
        }};
        const proxiedScreen = new Proxy(screen, screenHandler);
        Object.defineProperty(window, 'screen', {{
            get: () => proxiedScreen,
            configurable: true,
        }});
    }} catch(e) {{}}

}})();"""
