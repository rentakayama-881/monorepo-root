using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using Ulid = NUlid.Ulid;

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
    private readonly MongoDbContext _context;
    private readonly ILogger<UserWarningService> _logger;

    public UserWarningService(MongoDbContext context, ILogger<UserWarningService> logger)
    {
        _context = context;
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

        await _context.UserWarnings.InsertOneAsync(warning);
        _logger.LogInformation("Warning issued to user {UserId} by admin {AdminId}. Severity: {Severity}", 
            userId, adminId, severity);

        return warning.Id;
    }

    public async Task<List<UserWarningDto>> GetUserWarningsAsync(uint userId)
    {
        var warnings = await _context.UserWarnings
            .Find(w => w.UserId == userId)
            .SortByDescending(w => w.CreatedAt)
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
        var warning = await _context.UserWarnings
            .Find(w => w.Id == warningId)
            .FirstOrDefaultAsync();

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
        var warning = await _context.UserWarnings
            .Find(w => w.Id == warningId && w.UserId == userId)
            .FirstOrDefaultAsync();

        if (warning == null)
        {
            throw new KeyNotFoundException("Warning not found");
        }

        if (warning.Acknowledged)
        {
            throw new InvalidOperationException("Warning has already been acknowledged");
        }

        var update = Builders<UserWarning>.Update
            .Set(w => w.Acknowledged, true)
            .Set(w => w.AcknowledgedAt, DateTime.UtcNow);

        await _context.UserWarnings.UpdateOneAsync(w => w.Id == warningId, update);
        _logger.LogInformation("Warning {WarningId} acknowledged by user {UserId}", warningId, userId);
    }

    public async Task<int> GetUnacknowledgedCountAsync(uint userId)
    {
        var count = await _context.UserWarnings
            .CountDocumentsAsync(w => w.UserId == userId && !w.Acknowledged);
        return (int)count;
    }

    public async Task<PaginatedWarningsResponse> GetAllWarningsAsync(int page, int pageSize, uint? userId = null)
    {
        var filter = userId.HasValue 
            ? Builders<UserWarning>.Filter.Eq(w => w.UserId, userId.Value)
            : Builders<UserWarning>.Filter.Empty;

        var totalCount = await _context.UserWarnings.CountDocumentsAsync(filter);
        
        var warnings = await _context.UserWarnings
            .Find(filter)
            .SortByDescending(w => w.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
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

        return new PaginatedWarningsResponse(items, (int)totalCount, page, pageSize);
    }
}
