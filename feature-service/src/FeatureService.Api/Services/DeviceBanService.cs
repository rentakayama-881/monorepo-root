using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

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
    private readonly AppDbContext _db;
    private readonly ILogger<DeviceBanService> _logger;

    public DeviceBanService(AppDbContext db, ILogger<DeviceBanService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<string> BanDeviceAsync(string deviceFingerprint, uint? userId, string reason, uint adminId, string? reportId = null, bool isPermanent = true, DateTime? expiresAt = null)
    {
        // Check if device is already banned
        var existingBan = await _db.DeviceBans
            .FirstOrDefaultAsync(b => b.DeviceFingerprint == deviceFingerprint && b.IsActive);

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

        _db.DeviceBans.Add(ban);
        await _db.SaveChangesAsync();
        var banTypeStr = isPermanent ? "permanently" : "temporarily";
        _logger.LogWarning("Device banned {BanType}: {BanId} for user {UserId} by admin {AdminId}. Reason: {Reason}",
            banTypeStr, ban.Id, userId, adminId, reason);

        return ban.Id;
    }

    public async Task UnbanDeviceAsync(string banId, uint adminId)
    {
        var banEntity = await _db.DeviceBans.FirstOrDefaultAsync(b => b.Id == banId);
        if (banEntity == null)
        {
            throw new KeyNotFoundException("Device ban not found");
        }

        if (!banEntity.IsActive)
        {
            throw new InvalidOperationException("Device is not currently banned");
        }

        await _db.DeviceBans
            .Where(b => b.Id == banId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(b => b.IsActive, false)
                .SetProperty(b => b.UnbannedByAdminId, adminId)
                .SetProperty(b => b.UnbannedAt, DateTime.UtcNow)
                .SetProperty(b => b.UpdatedAt, DateTime.UtcNow));

        _logger.LogInformation("Device unbanned: {BanId} by admin {AdminId}", banId, adminId);
    }

    public async Task<bool> IsDeviceBannedAsync(string deviceFingerprint)
    {
        return await _db.DeviceBans
            .AnyAsync(b => b.DeviceFingerprint == deviceFingerprint && b.IsActive);
    }

    public async Task<(bool IsBanned, string? Message)> CheckDeviceBanAsync(string deviceFingerprint)
    {
        var ban = await _db.DeviceBans
            .FirstOrDefaultAsync(b => b.DeviceFingerprint == deviceFingerprint && b.IsActive);

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
        var query = activeOnly
            ? _db.DeviceBans.Where(b => b.IsActive)
            : _db.DeviceBans.AsQueryable();

        var totalCount = await query.CountAsync();

        var bans = await query
            .OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
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

        return new PaginatedDeviceBansResponse(dtos, totalCount, page, pageSize);
    }

    public async Task<DeviceBanDto?> GetBanByIdAsync(string banId)
    {
        var ban = await _db.DeviceBans
            .FirstOrDefaultAsync(b => b.Id == banId);

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
