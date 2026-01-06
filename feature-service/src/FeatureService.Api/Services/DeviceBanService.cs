using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using NUlid;

namespace FeatureService.Api.Services;

public interface IDeviceBanService
{
    Task<string> BanDeviceAsync(uint userId, string deviceFingerprint, string reason, string? reportId, uint adminId, string? userAgent, string? ipAddress, string? username);
    Task UnbanDeviceAsync(string banId, uint adminId, string unbanReason);
    Task<bool> IsDeviceBannedAsync(string deviceFingerprint);
    Task<CheckDeviceBanResponse> CheckDeviceBanAsync(string deviceFingerprint);
    Task<PaginatedDeviceBansResponse> GetActiveBansAsync(int page, int pageSize);
    Task<PaginatedDeviceBansResponse> GetAllBansAsync(int page, int pageSize, bool? activeOnly);
    Task<DeviceBan?> GetBanByIdAsync(string banId);
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

    public async Task<string> BanDeviceAsync(uint userId, string deviceFingerprint, string reason, string? reportId, uint adminId, string? userAgent, string? ipAddress, string? username)
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
            UserId = userId,
            Username = username,
            Reason = reason,
            ReportId = reportId,
            IsActive = true,
            BannedByAdminId = adminId,
            UserAgent = userAgent,
            IpAddress = ipAddress,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _context.DeviceBans.InsertOneAsync(ban);
        _logger.LogWarning("Device banned: {BanId} for user {UserId} by admin {AdminId}. Reason: {Reason}", 
            ban.Id, userId, adminId, reason);

        return ban.Id;
    }

    public async Task UnbanDeviceAsync(string banId, uint adminId, string unbanReason)
    {
        var ban = await GetBanByIdAsync(banId);
        if (ban == null)
        {
            throw new KeyNotFoundException("Device ban not found");
        }

        if (!ban.IsActive)
        {
            throw new InvalidOperationException("Device is not currently banned");
        }

        var update = Builders<DeviceBan>.Update
            .Set(b => b.IsActive, false)
            .Set(b => b.UnbannedByAdminId, adminId)
            .Set(b => b.UnbannedAt, DateTime.UtcNow)
            .Set(b => b.UnbanReason, unbanReason)
            .Set(b => b.UpdatedAt, DateTime.UtcNow);

        await _context.DeviceBans.UpdateOneAsync(b => b.Id == banId, update);
        _logger.LogInformation("Device unbanned: {BanId} by admin {AdminId}. Reason: {Reason}", 
            banId, adminId, unbanReason);
    }

    public async Task<bool> IsDeviceBannedAsync(string deviceFingerprint)
    {
        var count = await _context.DeviceBans
            .CountDocumentsAsync(b => b.DeviceFingerprint == deviceFingerprint && b.IsActive);
        return count > 0;
    }

    public async Task<CheckDeviceBanResponse> CheckDeviceBanAsync(string deviceFingerprint)
    {
        var ban = await _context.DeviceBans
            .Find(b => b.DeviceFingerprint == deviceFingerprint && b.IsActive)
            .FirstOrDefaultAsync();

        if (ban == null)
        {
            return new CheckDeviceBanResponse(false, null, null);
        }

        return new CheckDeviceBanResponse(true, ban.Reason, ban.CreatedAt);
    }

    public async Task<PaginatedDeviceBansResponse> GetActiveBansAsync(int page, int pageSize)
    {
        return await GetAllBansAsync(page, pageSize, true);
    }

    public async Task<PaginatedDeviceBansResponse> GetAllBansAsync(int page, int pageSize, bool? activeOnly)
    {
        var filterBuilder = Builders<DeviceBan>.Filter;
        var filter = filterBuilder.Empty;

        if (activeOnly.HasValue)
        {
            filter = filterBuilder.Eq(b => b.IsActive, activeOnly.Value);
        }

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
            b.UnbannedAt
        )).ToList();

        return new PaginatedDeviceBansResponse(dtos, (int)totalCount, page, pageSize);
    }

    public async Task<DeviceBan?> GetBanByIdAsync(string banId)
    {
        return await _context.DeviceBans
            .Find(b => b.Id == banId)
            .FirstOrDefaultAsync();
    }
}
