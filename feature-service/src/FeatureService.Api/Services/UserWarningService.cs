using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public interface IUserWarningService
{
    Task<string> CreateWarningAsync(uint userId, string reason, string message, string severity, uint adminId, string? reportId = null);
    Task<List<UserWarningDto>> GetUserWarningsAsync(uint userId);
    Task<UserWarningDto?> GetWarningByIdAsync(string warningId);
    Task AcknowledgeWarningAsync(string warningId, uint userId);
    Task<int> GetUnacknowledgedCountAsync(uint userId);
    Task<PaginatedWarningsResponse> GetAllWarningsAsync(int page, int pageSize, uint? userId = null);
}

public class UserWarningService : IUserWarningService
{
    private readonly AppDbContext _db;
    private readonly ILogger<UserWarningService> _logger;

    public UserWarningService(AppDbContext db, ILogger<UserWarningService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<string> CreateWarningAsync(uint userId, string reason, string message, string severity, uint adminId, string? reportId = null)
    {
        // Validate severity
        if (!WarningSeverity.All.Contains(severity))
        {
            throw new ArgumentException("Invalid severity. Must be minor, moderate, or severe");
        }

        var warning = new UserWarning
        {
            Id = $"wrn_{Ulid.NewUlid()}",
            UserId = userId,
            ReportId = reportId,
            Reason = reason,
            Message = message,
            Severity = severity,
            IssuedByAdminId = adminId,
            Acknowledged = false,
            CreatedAt = DateTime.UtcNow
        };

        _db.UserWarnings.Add(warning);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Warning issued to user {UserId} by admin {AdminId}. Severity: {Severity}", 
            userId, adminId, severity);

        return warning.Id;
    }

    public async Task<List<UserWarningDto>> GetUserWarningsAsync(uint userId)
    {
        var warnings = await _db.UserWarnings
            .Where(w => w.UserId == userId)
            .OrderByDescending(w => w.CreatedAt)
            .ToListAsync();

        return warnings.Select(w => new UserWarningDto(
            w.Id,
            w.Reason,
            w.Message,
            w.Severity,
            w.Acknowledged,
            w.CreatedAt,
            w.AcknowledgedAt
        )).ToList();
    }

    public async Task<UserWarningDto?> GetWarningByIdAsync(string warningId)
    {
        var warning = await _db.UserWarnings
            .FirstOrDefaultAsync(w => w.Id == warningId);

        if (warning == null) return null;

        return new UserWarningDto(
            warning.Id,
            warning.Reason,
            warning.Message,
            warning.Severity,
            warning.Acknowledged,
            warning.CreatedAt,
            warning.AcknowledgedAt
        );
    }

    public async Task AcknowledgeWarningAsync(string warningId, uint userId)
    {
        var warning = await _db.UserWarnings
            .FirstOrDefaultAsync(w => w.Id == warningId && w.UserId == userId);

        if (warning == null)
        {
            throw new KeyNotFoundException("Warning not found");
        }

        if (warning.Acknowledged)
        {
            throw new InvalidOperationException("Warning has already been acknowledged");
        }

        await _db.UserWarnings
            .Where(w => w.Id == warningId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(w => w.Acknowledged, true)
                .SetProperty(w => w.AcknowledgedAt, DateTime.UtcNow));

        _logger.LogInformation("Warning {WarningId} acknowledged by user {UserId}", warningId, userId);
    }

    public async Task<int> GetUnacknowledgedCountAsync(uint userId)
    {
        return await _db.UserWarnings
            .CountAsync(w => w.UserId == userId && !w.Acknowledged);
    }

    public async Task<PaginatedWarningsResponse> GetAllWarningsAsync(int page, int pageSize, uint? userId = null)
    {
        var query = userId.HasValue
            ? _db.UserWarnings.Where(w => w.UserId == userId.Value)
            : _db.UserWarnings.AsQueryable();

        var totalCount = await query.CountAsync();
        
        var warnings = await query
            .OrderByDescending(w => w.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var items = warnings.Select(w => new UserWarningDto(
            w.Id,
            w.Reason,
            w.Message,
            w.Severity,
            w.Acknowledged,
            w.CreatedAt,
            w.AcknowledgedAt,
            w.UserId,
            w.IssuedByAdminId
        )).ToList();

        return new PaginatedWarningsResponse(items, totalCount, page, pageSize);
    }
}
