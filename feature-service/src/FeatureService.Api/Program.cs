using Serilog;
using FeatureService.Api;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateLogger();

try
{
    Log.Information("Starting Feature Service");

    var builder = WebApplication.CreateBuilder(args);

    builder.WebHost.ConfigureKestrel(options =>
    {
        options.Limits.MaxRequestBodySize = 524_288_000; // 500 MB
    });

    builder.Host.UseSerilog();

    builder.AddFeatureServices();

    var app = builder.Build();

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
