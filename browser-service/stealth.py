"""Anti-fingerprinting / stealth module for browser sessions.

Extracted from browser-manager/main.py — constants, helpers, and the full
stealth JavaScript builder used to inject anti-detection measures into
every Chromium page context.
"""
import hashlib

from ua_database import USER_AGENTS, GPU_RENDERERS  # noqa: F401 — re-exported

# ──────────────────────────────────────────────────────────────────────────────
# Constants (UA + GPU imported from ua_database.py)
# ──────────────────────────────────────────────────────────────────────────────

STEALTH_CHROMIUM_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-infobars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    # WebRTC leak protection
    "--webrtc-ip-handling-policy=disable_non_proxied_udp",
    "--enforce-webrtc-ip-permission-check",
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
    timezone: str = "Asia/Jakarta",
    languages: list[str] | None = None,
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
    9. WebRTC leak protection
    10. Timezone spoof (Intl + Date)
    """
    lang_list = languages or ["en-US", "en"]
    lang_js = ", ".join(f"'{l}'" for l in lang_list)
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
        languages: [{lang_js}],
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

    // ═══ 9. TIMEZONE SPOOF ═══
    try {{
        const targetTZ = '{timezone}';

        // Override Intl.DateTimeFormat to always use target timezone
        const OrigDTF = Intl.DateTimeFormat;
        const ProxiedDTF = nativize(function(...args) {{
            const opts = args[1] || {{}};
            if (!opts.timeZone) opts.timeZone = targetTZ;
            args[1] = opts;
            return new OrigDTF(...args);
        }}, 'DateTimeFormat');
        ProxiedDTF.prototype = OrigDTF.prototype;
        ProxiedDTF.supportedLocalesOf = OrigDTF.supportedLocalesOf;
        Intl.DateTimeFormat = ProxiedDTF;

        // Override resolvedOptions to always report target timezone
        const origResolved = OrigDTF.prototype.resolvedOptions;
        OrigDTF.prototype.resolvedOptions = nativize(function() {{
            const opts = origResolved.call(this);
            opts.timeZone = targetTZ;
            return opts;
        }}, 'resolvedOptions');

        // Override Date.prototype.getTimezoneOffset
        // Compute offset for target timezone
        const getOffsetForTZ = (tz) => {{
            try {{
                const now = new Date();
                const utcStr = now.toLocaleString('en-US', {{ timeZone: 'UTC' }});
                const tzStr = now.toLocaleString('en-US', {{ timeZone: tz }});
                return (new Date(utcStr) - new Date(tzStr)) / 60000;
            }} catch(e) {{ return new Date().getTimezoneOffset(); }}
        }};
        const tzOffset = getOffsetForTZ(targetTZ);
        Date.prototype.getTimezoneOffset = nativize(function() {{
            return tzOffset;
        }}, 'getTimezoneOffset');
    }} catch(e) {{}}

    // ═══ 10. WEBRTC LEAK PROTECTION ═══
    try {{
        const origRTC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        if (origRTC) {{
            const wrappedRTC = nativize(function(...args) {{
                const config = args[0] || {{}};
                // Strip public STUN servers to prevent IP leak
                if (config.iceServers) {{
                    config.iceServers = config.iceServers.filter(s => {{
                        const urls = Array.isArray(s.urls) ? s.urls : [s.urls || s.url || ''];
                        return !urls.some(u => typeof u === 'string' && u.includes('stun:'));
                    }});
                }}
                const pc = new origRTC(config, args[1]);
                return pc;
            }}, 'RTCPeerConnection');

            wrappedRTC.prototype = origRTC.prototype;
            wrappedRTC.generateCertificate = origRTC.generateCertificate;

            if (window.RTCPeerConnection) window.RTCPeerConnection = wrappedRTC;
            if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = wrappedRTC;
        }}
    }} catch(e) {{}}

    // ═══ 11. PLUGINS & MIMETYPES ═══
    try {{
        const fakePlugins = [
            {{ name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format',
               mimeTypes: [{{ type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' }}] }},
            {{ name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '',
               mimeTypes: [{{ type: 'application/pdf', suffixes: 'pdf', description: '' }}] }},
            {{ name: 'Native Client', filename: 'internal-nacl-plugin', description: '',
               mimeTypes: [
                   {{ type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' }},
                   {{ type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' }},
               ] }},
        ];

        const allMimeTypes = [];
        const pluginArray = [];

        for (const p of fakePlugins) {{
            const plugin = Object.create(Plugin.prototype);
            const mts = [];
            for (const m of p.mimeTypes) {{
                const mt = Object.create(MimeType.prototype);
                Object.defineProperties(mt, {{
                    type: {{ value: m.type, enumerable: true }},
                    suffixes: {{ value: m.suffixes, enumerable: true }},
                    description: {{ value: m.description, enumerable: true }},
                    enabledPlugin: {{ value: plugin, enumerable: true }},
                }});
                mts.push(mt);
                allMimeTypes.push(mt);
            }}
            Object.defineProperties(plugin, {{
                name: {{ value: p.name, enumerable: true }},
                filename: {{ value: p.filename, enumerable: true }},
                description: {{ value: p.description, enumerable: true }},
                length: {{ value: mts.length, enumerable: true }},
            }});
            for (let i = 0; i < mts.length; i++) {{
                Object.defineProperty(plugin, i, {{ value: mts[i], enumerable: true }});
                Object.defineProperty(plugin, mts[i].type, {{ value: mts[i] }});
            }}
            plugin.item = nativize((i) => mts[i] || null, 'item');
            plugin.namedItem = nativize((n) => mts.find(m => m.type === n) || null, 'namedItem');
            plugin[Symbol.iterator] = function*() {{ for (const m of mts) yield m; }};
            pluginArray.push(plugin);
        }}

        // Override navigator.plugins
        const fakePluginArray = Object.create(PluginArray.prototype);
        Object.defineProperty(fakePluginArray, 'length', {{ value: pluginArray.length, enumerable: true }});
        for (let i = 0; i < pluginArray.length; i++) {{
            Object.defineProperty(fakePluginArray, i, {{ value: pluginArray[i], enumerable: true }});
            Object.defineProperty(fakePluginArray, pluginArray[i].name, {{ value: pluginArray[i] }});
        }}
        fakePluginArray.item = nativize((i) => pluginArray[i] || null, 'item');
        fakePluginArray.namedItem = nativize((n) => pluginArray.find(p => p.name === n) || null, 'namedItem');
        fakePluginArray.refresh = nativize(() => {{}}, 'refresh');
        fakePluginArray[Symbol.iterator] = function*() {{ for (const p of pluginArray) yield p; }};

        Object.defineProperty(Navigator.prototype, 'plugins', {{
            get: nativize(() => fakePluginArray, 'get plugins'),
            configurable: true,
        }});

        // Override navigator.mimeTypes
        const fakeMimeArray = Object.create(MimeTypeArray.prototype);
        Object.defineProperty(fakeMimeArray, 'length', {{ value: allMimeTypes.length, enumerable: true }});
        for (let i = 0; i < allMimeTypes.length; i++) {{
            Object.defineProperty(fakeMimeArray, i, {{ value: allMimeTypes[i], enumerable: true }});
            Object.defineProperty(fakeMimeArray, allMimeTypes[i].type, {{ value: allMimeTypes[i] }});
        }}
        fakeMimeArray.item = nativize((i) => allMimeTypes[i] || null, 'item');
        fakeMimeArray.namedItem = nativize((n) => allMimeTypes.find(m => m.type === n) || null, 'namedItem');
        fakeMimeArray[Symbol.iterator] = function*() {{ for (const m of allMimeTypes) yield m; }};

        Object.defineProperty(Navigator.prototype, 'mimeTypes', {{
            get: nativize(() => fakeMimeArray, 'get mimeTypes'),
            configurable: true,
        }});

        // navigator.pdfViewerEnabled
        Object.defineProperty(Navigator.prototype, 'pdfViewerEnabled', {{
            get: nativize(() => true, 'get pdfViewerEnabled'),
            configurable: true,
        }});
    }} catch(e) {{}}

    // ═══ 12. PERMISSIONS API ═══
    try {{
        const origQuery = navigator.permissions.query.bind(navigator.permissions);
        const permMap = {{
            'notifications': 'prompt',
            'geolocation': 'prompt',
            'camera': 'prompt',
            'microphone': 'prompt',
            'clipboard-read': 'prompt',
            'clipboard-write': 'granted',
            'persistent-storage': 'prompt',
            'accelerometer': 'granted',
            'gyroscope': 'granted',
            'magnetometer': 'granted',
        }};

        navigator.permissions.query = nativize(async function(desc) {{
            const name = desc && desc.name;
            if (name && name in permMap) {{
                return {{
                    state: permMap[name],
                    status: permMap[name],
                    onchange: null,
                    addEventListener: nativize(() => {{}}, 'addEventListener'),
                    removeEventListener: nativize(() => {{}}, 'removeEventListener'),
                    dispatchEvent: nativize(() => true, 'dispatchEvent'),
                }};
            }}
            try {{ return await origQuery(desc); }} catch(e) {{
                return {{ state: 'prompt', status: 'prompt', onchange: null,
                    addEventListener: () => {{}}, removeEventListener: () => {{}}, dispatchEvent: () => true }};
            }}
        }}, 'query');
    }} catch(e) {{}}

    // ═══ 13. CONNECTION & BATTERY ═══
    try {{
        // navigator.connection (NetworkInformation)
        const connInfo = {{
            effectiveType: '4g',
            downlink: 1.5 + prng() * 8.5,
            rtt: 50 + Math.floor(prng() * 100),
            saveData: false,
            type: 'wifi',
            onchange: null,
            addEventListener: nativize(() => {{}}, 'addEventListener'),
            removeEventListener: nativize(() => {{}}, 'removeEventListener'),
            dispatchEvent: nativize(() => true, 'dispatchEvent'),
        }};
        Object.defineProperty(Navigator.prototype, 'connection', {{
            get: nativize(() => connInfo, 'get connection'),
            configurable: true,
        }});

        // navigator.getBattery()
        const batteryInfo = {{
            charging: prng() > 0.3,
            chargingTime: prng() > 0.5 ? 0 : Math.floor(prng() * 3600),
            dischargingTime: Infinity,
            level: 0.5 + prng() * 0.5,
            onchargingchange: null,
            onchargingtimechange: null,
            ondischargingtimechange: null,
            onlevelchange: null,
            addEventListener: nativize(() => {{}}, 'addEventListener'),
            removeEventListener: nativize(() => {{}}, 'removeEventListener'),
            dispatchEvent: nativize(() => true, 'dispatchEvent'),
        }};
        if (Navigator.prototype.getBattery) {{
            Navigator.prototype.getBattery = nativize(
                () => Promise.resolve(batteryInfo), 'getBattery'
            );
        }}
    }} catch(e) {{}}

    // ═══ 14. FONT ENUMERATION DEFENSE ═══
    try {{
        // Per-platform realistic font lists
        const platformFonts = {{
            'Win32': ['Arial', 'Arial Black', 'Calibri', 'Cambria', 'Cambria Math',
                'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel',
                'Courier New', 'Georgia', 'Impact', 'Lucida Console', 'Lucida Sans Unicode',
                'Microsoft Sans Serif', 'Palatino Linotype', 'Segoe Print', 'Segoe Script',
                'Segoe UI', 'Segoe UI Symbol', 'Tahoma', 'Times New Roman', 'Trebuchet MS',
                'Verdana', 'Wingdings'],
            'MacIntel': ['Arial', 'Arial Black', 'Comic Sans MS', 'Courier New',
                'Georgia', 'Helvetica', 'Helvetica Neue', 'Impact', 'Lucida Grande',
                'Monaco', 'Palatino', 'San Francisco', 'Times', 'Times New Roman',
                'Trebuchet MS', 'Verdana', 'Menlo', 'Avenir', 'Avenir Next',
                'Futura', 'Gill Sans', 'Optima', 'Baskerville'],
            'Linux x86_64': ['Arial', 'Courier New', 'DejaVu Sans', 'DejaVu Sans Mono',
                'DejaVu Serif', 'FreeMono', 'FreeSans', 'FreeSerif', 'Georgia',
                'Liberation Mono', 'Liberation Sans', 'Liberation Serif',
                'Noto Sans', 'Times New Roman', 'Trebuchet MS', 'Verdana'],
        }};
        const platform = navOverrides.platform || 'Win32';
        const myFonts = new Set(platformFonts[platform] || platformFonts['Win32']);

        // Override document.fonts.check() to claim platform fonts exist
        if (document.fonts && document.fonts.check) {{
            const origCheck = document.fonts.check.bind(document.fonts);
            document.fonts.check = nativize(function(font, text) {{
                // Extract font family name from CSS font shorthand
                const match = font.match(/['"]?([^'",$]+)['"]?\\s*$/);
                const family = match ? match[1].trim() : '';
                if (myFonts.has(family)) return true;
                return origCheck(font, text);
            }}, 'check');
        }}
    }} catch(e) {{}}

}})();"""
