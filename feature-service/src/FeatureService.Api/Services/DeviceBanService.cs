using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using Ulid = NUlid.Ulid;

namespace FeatureService.Api.Services;

public interface IDeviceBanService
{
    Task<string> BanDeviceAsync(string deviceFingerprint, uint? userId, string reason, uint adminId, string? reportId = null, bool isPermanent = true, DateTime? expiresAt = null);
    Task UnbanDeviceAsync(string banId, uint adminId);
    Task<bool> IsDeviceBannedAsync(string deviceFingerprint);
    Task<(bool IsBanned, string? Message)> CheckDeviceBanAsync(string deviceFingerprint);
    Task<PaginatedDeviceBansResponse> GetDeviceBansAsync(int page, int pageSize, bool activeOnly = true);
    Task<DeviceBanDto?> GetBanByIdAsync(string banId);
}

public class DeviceBanService : IDeviceBanService
{
    private readonly MongoDbContext _context;
    private readonly ILogger<DeviceBanService> _logger;

    public DeviceBanService(MongoDbContext context, ILogger<DeviceBanService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<string> BanDeviceAsync(string deviceFingerprint, uint? userId, string reason, uint adminId, string? reportId = null, bool isPermanent = true, DateTime? expiresAt = null)
    {
        // Check if device is already banned
        var existingBan = await _context.DeviceBans
            .Find(b => b.DeviceFingerprint == deviceFingerprint && b.IsActive)
            .FirstOrDefaultAsync();

        if (existingBan != null)
        {
            throw new InvalidOperationException("Device is already banned");
        }

        var ban = new DeviceBan
        {
            Id = $"ban_{Ulid.NewUlid()}",
            DeviceFingerprint = deviceFingerprint,
            UserId = userId ?? 0,
            Username = null,
            Reason = reason,
            ReportId = reportId,
            IsActive = true,
            BannedByAdminId = adminId,
            UserAgent = null,
            IpAddress = null,
            IsPermanent = isPermanent,
            ExpiresAt = expiresAt,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _context.DeviceBans.InsertOneAsync(ban);
        var banTypeStr = isPermanent ? "permanently" : "temporarily";
        _logger.LogWarning("Device banned {BanType}: {BanId} for user {UserId} by admin {AdminId}. Reason: {Reason}",
            banTypeStr, ban.Id, userId, adminId, reason);

        return ban.Id;
    }

    public async Task UnbanDeviceAsync(string banId, uint adminId)
    {
        var banEntity = await _context.DeviceBans.Find(b => b.Id == banId).FirstOrDefaultAsync();
        if (banEntity == null)
        {
            throw new KeyNotFoundException("Device ban not found");
        }

        if (!banEntity.IsActive)
        {
            throw new InvalidOperationException("Device is not currently banned");
        }

        var update = Builders<DeviceBan>.Update
            .Set(b => b.IsActive, false)
            .Set(b => b.UnbannedByAdminId, adminId)
            .Set(b => b.UnbannedAt, DateTime.UtcNow)
            .Set(b => b.UpdatedAt, DateTime.UtcNow);

        await _context.DeviceBans.UpdateOneAsync(b => b.Id == banId, update);
        _logger.LogInformation("Device unbanned: {BanId} by admin {AdminId}", banId, adminId);
    }

    public async Task<bool> IsDeviceBannedAsync(string deviceFingerprint)
    {
        var count = await _context.DeviceBans
            .CountDocumentsAsync(b => b.DeviceFingerprint == deviceFingerprint && b.IsActive);
        return count > 0;
    }

    public async Task<(bool IsBanned, string? Message)> CheckDeviceBanAsync(string deviceFingerprint)
    {
        var ban = await _context.DeviceBans
            .Find(b => b.DeviceFingerprint == deviceFingerprint && b.IsActive)
            .FirstOrDefaultAsync();

        if (ban == null)
        {
            return (false, null);
        }

        // Check if ban has expired (for temporary bans)
        if (!ban.IsPermanent && ban.ExpiresAt.HasValue && ban.ExpiresAt.Value < DateTime.UtcNow)
        {
            return (false, null); // Ban has expired, not banned
        }

        var banType = ban.IsPermanent ? "permanently" : "temporarily";
        var message = $"This device has been {banType} banned. Reason: {ban.Reason}";
        if (!ban.IsPermanent && ban.ExpiresAt.HasValue)
        {
            message += $" (expires: {ban.ExpiresAt.Value:yyyy-MM-dd HH:mm:ss} UTC)";
        }

        return (true, message);
    }

    public async Task<PaginatedDeviceBansResponse> GetDeviceBansAsync(int page, int pageSize, bool activeOnly = true)
    {
        var filterBuilder = Builders<DeviceBan>.Filter;
        var filter = activeOnly 
            ? filterBuilder.Eq(b => b.IsActive, true)
            : filterBuilder.Empty;

        var totalCount = await _context.DeviceBans.CountDocumentsAsync(filter);

        var bans = await _context.DeviceBans
            .Find(filter)
            .SortByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        var dtos = bans.Select(b => new DeviceBanDto(
            b.Id,
            b.DeviceFingerprint,
            b.UserId,
            b.Username,
            b.Reason,
            b.IsActive,
            b.BannedByAdminId,
            b.CreatedAt,
            b.UnbannedAt,
            b.IsPermanent,
            b.ExpiresAt
        )).ToList();

        return new PaginatedDeviceBansResponse(dtos, (int)totalCount, page, pageSize);
    }

    public async Task<DeviceBanDto?> GetBanByIdAsync(string banId)
    {
        var ban = await _context.DeviceBans
            .Find(b => b.Id == banId)
            .FirstOrDefaultAsync();

        if (ban == null) return null;

        return new DeviceBanDto(
            ban.Id,
            ban.DeviceFingerprint,
            ban.UserId,
            ban.Username,
            ban.Reason,
            ban.IsActive,
            ban.BannedByAdminId,
            ban.CreatedAt,
            ban.UnbannedAt,
            ban.IsPermanent,
            ban.ExpiresAt
        );
    }
}
