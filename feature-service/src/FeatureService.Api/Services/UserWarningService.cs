using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using NUlid;

namespace FeatureService.Api.Services;

public interface IUserWarningService
{
    Task<string> CreateWarningAsync(uint userId, string reason, string message, string severity, string? reportId, uint adminId);
    Task<UserWarningsResponse> GetUserWarningsAsync(uint userId);
    Task AcknowledgeWarningAsync(string warningId, uint userId);
    Task<int> GetUnacknowledgedCountAsync(uint userId);
    Task<int> GetTotalWarningCountAsync(uint userId);
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

    public async Task<string> CreateWarningAsync(uint userId, string reason, string message, string severity, string? reportId, uint adminId)
    {
        // Validate severity
        if (severity != WarningSeverity.Minor && severity != WarningSeverity.Moderate && severity != WarningSeverity.Severe)
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

    public async Task<UserWarningsResponse> GetUserWarningsAsync(uint userId)
    {
        var warnings = await _context.UserWarnings
            .Find(w => w.UserId == userId)
            .SortByDescending(w => w.CreatedAt)
            .ToListAsync();

        var dtos = warnings.Select(w => new UserWarningDto(
            w.Id,
            w.Reason,
            w.Message,
            w.Severity,
            w.Acknowledged,
            w.CreatedAt,
            w.AcknowledgedAt
        )).ToList();

        var unacknowledgedCount = warnings.Count(w => !w.Acknowledged);

        return new UserWarningsResponse(dtos, warnings.Count, unacknowledgedCount);
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

    public async Task<int> GetTotalWarningCountAsync(uint userId)
    {
        var count = await _context.UserWarnings
            .CountDocumentsAsync(w => w.UserId == userId);
        return (int)count;
    }
}
