using System.Security.Cryptography;
using System.Text;
using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
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
    private readonly IMongoCollection<BrowserProfile> _profiles;
    private readonly IMongoCollection<BrowserSession> _sessions;
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

    public BrowserProfileService(MongoDbContext dbContext, ILogger<BrowserProfileService> logger)
    {
        _profiles = dbContext.BrowserProfiles;
        _sessions = dbContext.BrowserSessions;
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

        await _profiles.InsertOneAsync(profile);
        _logger.LogInformation("Profil browser {ProfileId} dibuat untuk user {UserId}", profileId, userId);

        return MapToDto(profile);
    }

    public async Task<BrowserProfileListResponse> GetProfilesAsync(uint userId)
    {
        var profiles = await _profiles
            .Find(p => p.UserId == userId)
            .SortByDescending(p => p.CreatedAt)
            .ToListAsync();

        var dtos = profiles.Select(MapToDto).ToList();
        return new BrowserProfileListResponse(dtos, dtos.Count);
    }

    public async Task<BrowserProfileDto?> GetProfileByIdAsync(string profileId, uint userId)
    {
        var profile = await _profiles
            .Find(p => p.Id == profileId && p.UserId == userId)
            .FirstOrDefaultAsync();

        return profile == null ? null : MapToDto(profile);
    }

    public async Task<BrowserProfileDto?> UpdateProfileAsync(string profileId, uint userId, UpdateBrowserProfileRequest request)
    {
        var filter = Builders<BrowserProfile>.Filter.And(
            Builders<BrowserProfile>.Filter.Eq(p => p.Id, profileId),
            Builders<BrowserProfile>.Filter.Eq(p => p.UserId, userId));

        var updateDef = Builders<BrowserProfile>.Update
            .Set(p => p.UpdatedAt, DateTime.UtcNow);

        if (request.Name != null)
            updateDef = updateDef.Set(p => p.Name, request.Name);
        if (request.ProxyServer != null)
            updateDef = updateDef.Set(p => p.ProxyServer, request.ProxyServer);
        if (request.ProxyUsername != null)
            updateDef = updateDef.Set(p => p.ProxyUsername, request.ProxyUsername);
        if (request.ProxyPassword != null)
            updateDef = updateDef.Set(p => p.ProxyPassword, request.ProxyPassword);
        if (request.Notes != null)
            updateDef = updateDef.Set(p => p.Notes, request.Notes);

        var result = await _profiles.FindOneAndUpdateAsync(
            filter,
            updateDef,
            new FindOneAndUpdateOptions<BrowserProfile> { ReturnDocument = ReturnDocument.After });

        if (result == null) return null;

        _logger.LogInformation("Profil browser {ProfileId} diperbarui oleh user {UserId}", profileId, userId);
        return MapToDto(result);
    }

    public async Task<bool> DeleteProfileAsync(string profileId, uint userId)
    {
        // Cek apakah ada sesi aktif yang menggunakan profil ini
        var activeSessionFilter = Builders<BrowserSession>.Filter.And(
            Builders<BrowserSession>.Filter.Eq(s => s.ProfileId, profileId),
            Builders<BrowserSession>.Filter.In(s => s.Status, new[]
            {
                BrowserSessionStatus.Starting,
                BrowserSessionStatus.Active
            }));

        var activeCount = await _sessions.CountDocumentsAsync(activeSessionFilter);
        if (activeCount > 0)
        {
            _logger.LogWarning("Gagal hapus profil {ProfileId}: masih ada {Count} sesi aktif", profileId, activeCount);
            throw new InvalidOperationException("Profil tidak dapat dihapus karena masih ada sesi aktif yang menggunakan profil ini");
        }

        var filter = Builders<BrowserProfile>.Filter.And(
            Builders<BrowserProfile>.Filter.Eq(p => p.Id, profileId),
            Builders<BrowserProfile>.Filter.Eq(p => p.UserId, userId));

        var result = await _profiles.DeleteOneAsync(filter);

        if (result.DeletedCount > 0)
        {
            _logger.LogInformation("Profil browser {ProfileId} dihapus oleh user {UserId}", profileId, userId);
        }

        return result.DeletedCount > 0;
    }

    public async Task UpdateLastSessionAsync(string profileId)
    {
        var update = Builders<BrowserProfile>.Update
            .Set(p => p.LastSessionAt, DateTime.UtcNow)
            .Set(p => p.UpdatedAt, DateTime.UtcNow);

        await _profiles.UpdateOneAsync(p => p.Id == profileId, update);
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
