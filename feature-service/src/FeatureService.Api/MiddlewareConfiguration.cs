using Serilog;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Middleware;
using Prometheus;

namespace FeatureService.Api;

public static class MiddlewareConfiguration
{
    public static async Task<WebApplication> ConfigureMiddlewarePipeline(this WebApplication app)
    {
        var enableSwagger =
            app.Environment.IsDevelopment()
            || string.Equals(
                Environment.GetEnvironmentVariable("ENABLE_SWAGGER"),
                "true",
                StringComparison.OrdinalIgnoreCase);

        // Ensure MongoDbContext is initialized at startup so index creation runs
        // before the first request hits financial/admin endpoints.
        using (var scope = app.Services.CreateScope())
        {
            var mongoContext = scope.ServiceProvider.GetRequiredService<MongoDbContext>();
            Log.Information("MongoDB context initialized and indexes ensured");
    
            if (app.Environment.IsProduction() || app.Environment.IsStaging())
            {
                try
                {
                    using var session = await mongoContext.Client.StartSessionAsync();
                    Log.Information("MongoDB replica set verified - transactions supported");
                }
                catch (Exception ex)
                {
                    Log.Fatal(ex, "FATAL: MongoDB does not support transactions. Production requires a replica set.");
                    throw;
                }
            }
        }
    
        // Configure middleware pipeline
        app.UseMiddleware<CorrelationIdMiddleware>();
        app.UseMiddleware<SecurityHeadersMiddleware>();
        app.UseMiddleware<RequestLoggingMiddleware>();
        app.UseMiddleware<ErrorHandlingMiddleware>();
    
        if (enableSwagger)
        {
            app.UseSwagger();
            app.UseSwaggerUI(c =>
            {
                c.SwaggerEndpoint("/swagger/v1/swagger.json", "Feature Service API v1");
                c.RoutePrefix = "swagger";
            });
        }
    
        // CORS must be before rate limiting so 429 responses include CORS headers
        app.UseCors();
    
        app.UseAuthentication();
        app.UseAuthorization();
    
        // Rate limiting after auth so Financial policy can identify users by JWT claim
        app.UseRateLimiting(options =>
        {
            options.MaxRequests = 100;  // 100 requests per minute (global)
            options.WindowSeconds = 60;
            options.FinancialMaxRequests = 30; // financial endpoints per user
            options.FinancialWindowSeconds = 60;
        });
    
        // PQC Signature validation for financial endpoints
        // Must be after Authentication so user context is available
        app.UseMiddleware<PqcSignatureMiddleware>();
    
        app.MapControllers();
        app.MapHealthChecks("/health");

        // Prometheus metrics endpoint (no auth required).
        app.MapMetrics();
    

        return app;
    }
}
