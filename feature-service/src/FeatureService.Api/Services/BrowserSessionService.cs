using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public interface IBrowserSessionService
{
    Task<StartBrowserSessionResponse> CreateSessionAsync(uint userId, StartBrowserSessionRequest request, string vncWsUrl);
    Task<BrowserSessionDto?> GetSessionAsync(string sessionId, uint userId);
    Task<BrowserSessionListResponse> GetSessionsAsync(uint userId, bool activeOnly = false);
    Task<int> GetActiveSessionCountAsync(uint userId);
    Task<StopBrowserSessionResponse> StopSessionAsync(string sessionId, uint userId, string stopReason);
    Task UpdateSessionPidsAsync(string sessionId, SessionProcessPids pids);
    Task MarkSessionErrorAsync(string sessionId, string errorMessage);
}

public class BrowserSessionService : IBrowserSessionService
{
    private readonly IMongoCollection<BrowserSession> _sessions;
    private readonly IMongoCollection<BrowserProfile> _profiles;
    private readonly ILogger<BrowserSessionService> _logger;

    public BrowserSessionService(MongoDbContext dbContext, ILogger<BrowserSessionService> logger)
    {
        _sessions = dbContext.BrowserSessions;
        _profiles = dbContext.BrowserProfiles;
        _logger = logger;
    }

    public async Task<StartBrowserSessionResponse> CreateSessionAsync(uint userId, StartBrowserSessionRequest request, string vncWsUrl)
    {
        // Ambil profil untuk snapshot nama
        var profile = await _profiles
            .Find(p => p.Id == request.ProfileId && p.UserId == userId)
            .FirstOrDefaultAsync();

        if (profile == null)
            throw new ArgumentException("Profil browser tidak ditemukan atau bukan milik Anda");

        var sessionId = $"bsn_{Ulid.NewUlid()}";
        var now = DateTime.UtcNow;

        var session = new BrowserSession
        {
            Id = sessionId,
            UserId = userId,
            ProfileId = request.ProfileId,
            ProfileName = profile.Name,
            Status = BrowserSessionStatus.Starting,
            StartedAt = now,
            CreatedAt = now
        };

        await _sessions.InsertOneAsync(session);
        _logger.LogInformation("Sesi browser {SessionId} dibuat untuk user {UserId} dengan profil {ProfileId}",
            sessionId, userId, request.ProfileId);

        return new StartBrowserSessionResponse(
            SessionId: sessionId,
            ProfileName: profile.Name,
            VncWsUrl: vncWsUrl,
            Status: BrowserSessionStatus.Starting.ToString());
    }

    public async Task<BrowserSessionDto?> GetSessionAsync(string sessionId, uint userId)
    {
        var session = await _sessions
            .Find(s => s.Id == sessionId && s.UserId == userId)
            .FirstOrDefaultAsync();

        return session == null ? null : MapToDto(session);
    }

    public async Task<BrowserSessionListResponse> GetSessionsAsync(uint userId, bool activeOnly = false)
    {
        FilterDefinition<BrowserSession> filter;

        if (activeOnly)
        {
            filter = Builders<BrowserSession>.Filter.And(
                Builders<BrowserSession>.Filter.Eq(s => s.UserId, userId),
                Builders<BrowserSession>.Filter.In(s => s.Status, new[]
                {
                    BrowserSessionStatus.Starting,
                    BrowserSessionStatus.Active
                }));
        }
        else
        {
            filter = Builders<BrowserSession>.Filter.Eq(s => s.UserId, userId);
        }

        var sessions = await _sessions
            .Find(filter)
            .SortByDescending(s => s.CreatedAt)
            .ToListAsync();

        var dtos = sessions.Select(MapToDto).ToList();
        return new BrowserSessionListResponse(dtos, dtos.Count);
    }

    public async Task<int> GetActiveSessionCountAsync(uint userId)
    {
        var filter = Builders<BrowserSession>.Filter.And(
            Builders<BrowserSession>.Filter.Eq(s => s.UserId, userId),
            Builders<BrowserSession>.Filter.In(s => s.Status, new[]
            {
                BrowserSessionStatus.Starting,
                BrowserSessionStatus.Active
            }));

        return (int)await _sessions.CountDocumentsAsync(filter);
    }

    public async Task<StopBrowserSessionResponse> StopSessionAsync(string sessionId, uint userId, string stopReason)
    {
        var filter = Builders<BrowserSession>.Filter.And(
            Builders<BrowserSession>.Filter.Eq(s => s.Id, sessionId),
            Builders<BrowserSession>.Filter.Eq(s => s.UserId, userId));

        var update = Builders<BrowserSession>.Update
            .Set(s => s.Status, BrowserSessionStatus.Stopped)
            .Set(s => s.StoppedAt, DateTime.UtcNow)
            .Set(s => s.StopReason, stopReason);

        var result = await _sessions.FindOneAndUpdateAsync(
            filter,
            update,
            new FindOneAndUpdateOptions<BrowserSession> { ReturnDocument = ReturnDocument.After });

        if (result == null)
            throw new InvalidOperationException("Sesi browser tidak ditemukan atau bukan milik Anda");

        _logger.LogInformation("Sesi browser {SessionId} dihentikan oleh user {UserId}, alasan: {Reason}",
            sessionId, userId, stopReason);

        return new StopBrowserSessionResponse(
            SessionId: result.Id,
            Status: result.Status.ToString(),
            BilledMinutes: result.BilledMinutes,
            TotalCost: result.TotalCost);
    }

    public async Task UpdateSessionPidsAsync(string sessionId, SessionProcessPids pids)
    {
        var update = Builders<BrowserSession>.Update
            .Set(s => s.ProcessPids, pids)
            .Set(s => s.Status, BrowserSessionStatus.Active);

        await _sessions.UpdateOneAsync(s => s.Id == sessionId, update);
        _logger.LogInformation("PID sesi {SessionId} diperbarui, status menjadi Active", sessionId);
    }

    public async Task MarkSessionErrorAsync(string sessionId, string errorMessage)
    {
        var update = Builders<BrowserSession>.Update
            .Set(s => s.Status, BrowserSessionStatus.Error)
            .Set(s => s.ErrorMessage, errorMessage)
            .Set(s => s.StoppedAt, DateTime.UtcNow)
            .Set(s => s.StopReason, "error");

        await _sessions.UpdateOneAsync(s => s.Id == sessionId, update);
        _logger.LogWarning("Sesi browser {SessionId} error: {Error}", sessionId, errorMessage);
    }

    // ──────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────

    private static BrowserSessionDto MapToDto(BrowserSession s) => new(
        Id: s.Id,
        ProfileId: s.ProfileId,
        ProfileName: s.ProfileName,
        Status: s.Status.ToString(),
        VncWsUrl: null, // VNC URL dikelola oleh browser-service, bukan disimpan di sesi
        StartedAt: s.StartedAt,
        StoppedAt: s.StoppedAt,
        BilledMinutes: s.BilledMinutes,
        TotalCost: s.TotalCost,
        StopReason: s.StopReason);
}
