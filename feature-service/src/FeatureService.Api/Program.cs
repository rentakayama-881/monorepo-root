using Serilog;
using FeatureService.Api;
using Prometheus;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateLogger();

try
{
    Log.Information("Starting Feature Service");

    var builder = WebApplication.CreateBuilder(args);

    builder.WebHost.ConfigureKestrel(options =>
    {
        options.Limits.MaxRequestBodySize = 10_485_760; // 10 MB
    });

    builder.WebHost.UseSentry(o =>
    {
        o.Dsn = builder.Configuration["SENTRY__DSN"] ?? Environment.GetEnvironmentVariable("SENTRY__DSN") ?? "";
        o.Environment = builder.Configuration["SENTRY__ENVIRONMENT"] ?? Environment.GetEnvironmentVariable("SENTRY__ENVIRONMENT") ?? "development";
        o.TracesSampleRate = double.TryParse(
            builder.Configuration["SENTRY__TRACES_SAMPLE_RATE"] ?? Environment.GetEnvironmentVariable("SENTRY__TRACES_SAMPLE_RATE"),
            out var rate) ? rate : 0.1;
        o.SendDefaultPii = false;
        o.AutoSessionTracking = true;
        o.IsGlobalModeEnabled = true;
    });

    builder.Host.UseSerilog();

    builder.AddFeatureServices();

    var app = builder.Build();

    app.UseSentryTracing();

    // Prometheus HTTP metrics (after Sentry so tracing wraps metric collection).
    app.UseHttpMetrics();

    await app.ConfigureMiddlewarePipeline();

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
