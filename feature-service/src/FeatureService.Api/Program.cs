using Serilog;
using FeatureService.Api;
using Prometheus;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

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

    // Auto-create EF Core schema (creates only if Feature Service tables don't exist)
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<FeatureService.Api.Infrastructure.Persistence.AppDbContext>();
        
        // Check if Feature Service tables exist by probing one
        var tablesExist = false;
        try
        {
            await db.Database.ExecuteSqlRawAsync("SELECT 1 FROM wallets LIMIT 0");
            tablesExist = true;
        }
        catch { /* Table doesn't exist yet */ }
        
        if (!tablesExist)
        {
            Log.Information("Creating Feature Service database tables...");
            var sql = db.Database.GenerateCreateScript();
            // Split by GO or semicolons and execute each statement separately, ignoring "already exists" errors
            var statements = sql.Split(new[] { ";\n", ";\r\n" }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var stmt in statements)
            {
                var trimmed = stmt.Trim();
                if (string.IsNullOrEmpty(trimmed)) continue;
                try
                {
                    await db.Database.ExecuteSqlRawAsync(trimmed);
                }
                catch (Npgsql.PostgresException ex) when (ex.SqlState == "42P07" || ex.SqlState == "42710")
                {
                    // 42P07 = duplicate table, 42710 = duplicate type — skip
                }
            }
            Log.Information("Feature Service database tables created successfully");
        }
        else
        {
            Log.Information("Feature Service database tables already exist");
        }
    }

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
