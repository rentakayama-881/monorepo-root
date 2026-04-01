using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public interface IBrowserProfileService
{
    Task<BrowserProfileDto> CreateProfileAsync(uint userId, CreateBrowserProfileRequest request);
    Task<BrowserProfileListResponse> GetProfilesAsync(uint userId);
    Task<BrowserProfileDto?> GetProfileByIdAsync(string profileId, uint userId);
    Task<BrowserProfileDto?> UpdateProfileAsync(string profileId, uint userId, UpdateBrowserProfileRequest request);
    Task<bool> DeleteProfileAsync(string profileId, uint userId);
    Task UpdateLastSessionAsync(string profileId);
}

public class BrowserProfileService : IBrowserProfileService
{
    private readonly AppDbContext _db;
    private readonly ILogger<BrowserProfileService> _logger;

    // Preset arrays for deterministic fingerprint generation
    private static readonly string[] UserAgentPresets =
    {
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0"
    };

    private static readonly (string Vendor, string Renderer)[] GpuPresets =
    {
        ("Google Inc. (NVIDIA)", "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)"),
        ("Google Inc. (NVIDIA)", "ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0)"),
        ("Google Inc. (AMD)", "ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)"),
        ("Google Inc. (Intel)", "ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)"),
        ("Google Inc. (NVIDIA)", "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)"),
        ("Google Inc. (AMD)", "ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0)")
    };

    private static readonly (int Width, int Height)[] ScreenPresets =
    {
        (1920, 1080),
        (2560, 1440),
        (1366, 768),
        (1536, 864),
        (1440, 900),
        (1680, 1050)
    };

    private static readonly string[] PlatformPresets =
    {
        "Win32",
        "Win32",
        "MacIntel",
        "Linux x86_64"
    };

    private static readonly string[] TimezonePresets =
    {
        "Asia/Jakarta",
        "Asia/Makassar",
        "Asia/Singapore",
        "America/New_York",
        "Europe/London",
        "Asia/Tokyo"
    };

    private static readonly string[] LanguagePresets =
    {
        "en-US",
        "id-ID",
        "en-GB",
        "ja-JP",
        "zh-CN",
        "ko-KR"
    };

    public BrowserProfileService(AppDbContext db, ILogger<BrowserProfileService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<BrowserProfileDto> CreateProfileAsync(uint userId, CreateBrowserProfileRequest request)
    {
        var profileId = $"bpf_{Ulid.NewUlid()}";
        var fingerprint = GenerateFingerprint(profileId);
        var userAgent = PickPreset(UserAgentPresets, profileId);

        var profile = new BrowserProfile
        {
            Id = profileId,
            UserId = userId,
            Name = request.Name,
            ProxyServer = request.ProxyServer,
            ProxyUsername = request.ProxyUsername,
            ProxyPassword = request.ProxyPassword,
            UserAgentPreset = userAgent,
            Fingerprint = fingerprint,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.BrowserProfiles.Add(profile);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Profil browser {ProfileId} dibuat untuk user {UserId}", profileId, userId);

        return MapToDto(profile);
    }

    public async Task<BrowserProfileListResponse> GetProfilesAsync(uint userId)
    {
        var profiles = await _db.BrowserProfiles
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        var dtos = profiles.Select(MapToDto).ToList();
        return new BrowserProfileListResponse(dtos, dtos.Count);
    }

    public async Task<BrowserProfileDto?> GetProfileByIdAsync(string profileId, uint userId)
    {
        var profile = await _db.BrowserProfiles
            .FirstOrDefaultAsync(p => p.Id == profileId && p.UserId == userId);

        return profile == null ? null : MapToDto(profile);
    }

    public async Task<BrowserProfileDto?> UpdateProfileAsync(string profileId, uint userId, UpdateBrowserProfileRequest request)
    {
        var profile = await _db.BrowserProfiles
            .FirstOrDefaultAsync(p => p.Id == profileId && p.UserId == userId);

        if (profile == null) return null;

        if (request.Name != null)
            profile.Name = request.Name;
        if (request.ProxyServer != null)
            profile.ProxyServer = request.ProxyServer;
        if (request.ProxyUsername != null)
            profile.ProxyUsername = request.ProxyUsername;
        if (request.ProxyPassword != null)
            profile.ProxyPassword = request.ProxyPassword;
        if (request.Notes != null)
            profile.Notes = request.Notes;

        profile.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Profil browser {ProfileId} diperbarui oleh user {UserId}", profileId, userId);
        return MapToDto(profile);
    }

    public async Task<bool> DeleteProfileAsync(string profileId, uint userId)
    {
        // Cek apakah ada sesi aktif yang menggunakan profil ini
        var activeStatuses = new[] { BrowserSessionStatus.Starting, BrowserSessionStatus.Active };
        var activeCount = await _db.BrowserSessions
            .CountAsync(s => s.ProfileId == profileId && activeStatuses.Contains(s.Status));

        if (activeCount > 0)
        {
            _logger.LogWarning("Gagal hapus profil {ProfileId}: masih ada {Count} sesi aktif", profileId, activeCount);
            throw new InvalidOperationException("Profil tidak dapat dihapus karena masih ada sesi aktif yang menggunakan profil ini");
        }

        var deleted = await _db.BrowserProfiles
            .Where(p => p.Id == profileId && p.UserId == userId)
            .ExecuteDeleteAsync();

        if (deleted > 0)
        {
            _logger.LogInformation("Profil browser {ProfileId} dihapus oleh user {UserId}", profileId, userId);
        }

        return deleted > 0;
    }

    public async Task UpdateLastSessionAsync(string profileId)
    {
        await _db.BrowserProfiles
            .Where(p => p.Id == profileId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.LastSessionAt, DateTime.UtcNow)
                .SetProperty(p => p.UpdatedAt, DateTime.UtcNow));
    }

    // ──────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────

    private static BrowserFingerprint GenerateFingerprint(string seed)
    {
        var gpu = PickPreset(GpuPresets, seed);
        var screen = PickPreset(ScreenPresets, seed);

        return new BrowserFingerprint
        {
            GpuVendor = gpu.Vendor,
            GpuRenderer = gpu.Renderer,
            ScreenWidth = screen.Width,
            ScreenHeight = screen.Height,
            ColorDepth = 24,
            Platform = PickPreset(PlatformPresets, seed),
            Timezone = PickPreset(TimezonePresets, seed),
            Language = PickPreset(LanguagePresets, seed)
        };
    }

    private static T PickPreset<T>(T[] presets, string seed)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(seed));
        var index = BitConverter.ToUInt32(hash, 0) % (uint)presets.Length;
        return presets[index];
    }

    private static BrowserProfileDto MapToDto(BrowserProfile p) => new(
        Id: p.Id,
        Name: p.Name,
        ProxyServer: p.ProxyServer,
        ProxyUsername: p.ProxyUsername,
        ProxyPassword: p.ProxyPassword,
        HasProxy: !string.IsNullOrEmpty(p.ProxyServer),
        UserAgentPreset: p.UserAgentPreset,
        Fingerprint: new BrowserFingerprintDto(
            p.Fingerprint.GpuVendor,
            p.Fingerprint.GpuRenderer,
            p.Fingerprint.ScreenWidth,
            p.Fingerprint.ScreenHeight,
            p.Fingerprint.ColorDepth,
            p.Fingerprint.Platform,
            p.Fingerprint.Timezone,
            p.Fingerprint.Language),
        Notes: p.Notes,
        LastSessionAt: p.LastSessionAt,
        CreatedAt: p.CreatedAt,
        UpdatedAt: p.UpdatedAt);
}
