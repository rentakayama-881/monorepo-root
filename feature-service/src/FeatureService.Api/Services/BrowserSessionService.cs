using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
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
    private readonly AppDbContext _db;
    private readonly ILogger<BrowserSessionService> _logger;

    public BrowserSessionService(AppDbContext db, ILogger<BrowserSessionService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<StartBrowserSessionResponse> CreateSessionAsync(uint userId, StartBrowserSessionRequest request, string vncWsUrl)
    {
        // Ambil profil untuk snapshot nama
        var profile = await _db.BrowserProfiles
            .FirstOrDefaultAsync(p => p.Id == request.ProfileId && p.UserId == userId);

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

        _db.BrowserSessions.Add(session);
        await _db.SaveChangesAsync();
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
        var session = await _db.BrowserSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);

        return session == null ? null : MapToDto(session);
    }

    public async Task<BrowserSessionListResponse> GetSessionsAsync(uint userId, bool activeOnly = false)
    {
        var activeStatuses = new[] { BrowserSessionStatus.Starting, BrowserSessionStatus.Active };

        var query = activeOnly
            ? _db.BrowserSessions.Where(s => s.UserId == userId && activeStatuses.Contains(s.Status))
            : _db.BrowserSessions.Where(s => s.UserId == userId);

        var sessions = await query
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        var dtos = sessions.Select(MapToDto).ToList();
        return new BrowserSessionListResponse(dtos, dtos.Count);
    }

    public async Task<int> GetActiveSessionCountAsync(uint userId)
    {
        var activeStatuses = new[] { BrowserSessionStatus.Starting, BrowserSessionStatus.Active };
        return await _db.BrowserSessions
            .CountAsync(s => s.UserId == userId && activeStatuses.Contains(s.Status));
    }

    public async Task<StopBrowserSessionResponse> StopSessionAsync(string sessionId, uint userId, string stopReason)
    {
        var session = await _db.BrowserSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);

        if (session == null)
            throw new InvalidOperationException("Sesi browser tidak ditemukan atau bukan milik Anda");

        session.Status = BrowserSessionStatus.Stopped;
        session.StoppedAt = DateTime.UtcNow;
        session.StopReason = stopReason;
        await _db.SaveChangesAsync();

        _logger.LogInformation("Sesi browser {SessionId} dihentikan oleh user {UserId}, alasan: {Reason}",
            sessionId, userId, stopReason);

        return new StopBrowserSessionResponse(
            SessionId: session.Id,
            Status: session.Status.ToString(),
            BilledMinutes: session.BilledMinutes,
            TotalCost: session.TotalCost);
    }

    public async Task UpdateSessionPidsAsync(string sessionId, SessionProcessPids pids)
    {
        var session = await _db.BrowserSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
        if (session != null)
        {
            session.ProcessPids = pids;
            session.Status = BrowserSessionStatus.Active;
            await _db.SaveChangesAsync();
        }
        _logger.LogInformation("PID sesi {SessionId} diperbarui, status menjadi Active", sessionId);
    }

    public async Task MarkSessionErrorAsync(string sessionId, string errorMessage)
    {
        await _db.BrowserSessions
            .Where(s => s.Id == sessionId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, BrowserSessionStatus.Error)
                .SetProperty(x => x.ErrorMessage, errorMessage)
                .SetProperty(x => x.StoppedAt, DateTime.UtcNow)
                .SetProperty(x => x.StopReason, "error"));

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
