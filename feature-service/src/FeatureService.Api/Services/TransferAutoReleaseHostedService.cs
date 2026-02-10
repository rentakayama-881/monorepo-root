using Microsoft.Extensions.Hosting;

namespace FeatureService.Api.Services;

/// <summary>
/// Background worker to auto-release expired escrow transfers (hold period finished).
/// This is required to support "auto-release after timer" without relying on a manual receiver claim.
/// </summary>
public sealed class TransferAutoReleaseHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TransferAutoReleaseHostedService> _logger;
    private readonly TimeSpan _interval;

    public TransferAutoReleaseHostedService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<TransferAutoReleaseHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        // Default to 60s. Clamp to avoid accidental tight loops or multi-hour stalls.
        var seconds = configuration.GetValue<int?>("Transfers:AutoReleaseIntervalSeconds");
        if (!seconds.HasValue)
        {
            if (int.TryParse(Environment.GetEnvironmentVariable("TRANSFERS__AUTORELEASEINTERVALSECONDS"), out var envSeconds))
            {
                seconds = envSeconds;
            }
            else
            {
                seconds = 60;
            }
        }

        seconds = Math.Clamp(seconds.Value, 10, 3600);
        _interval = TimeSpan.FromSeconds(seconds.Value);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Transfer auto-release worker started. IntervalSeconds: {Seconds}", _interval.TotalSeconds);

        // Run immediately on startup, then on interval.
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var transferService = scope.ServiceProvider.GetRequiredService<ITransferService>();
                await transferService.AutoReleaseExpiredTransfersAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Transfer auto-release cycle failed");
            }

            try
            {
                await Task.Delay(_interval, stoppingToken);
            }
            catch (TaskCanceledException)
            {
                // ignore
            }
        }

        _logger.LogInformation("Transfer auto-release worker stopped");
    }
}
