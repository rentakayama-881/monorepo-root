using Serilog;
using FeatureService.Api.Infrastructure.Persistence;
using FeatureService.Api.Middleware;
using Microsoft.EntityFrameworkCore;
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

        // Verify database connectivity at startup
        using (var scope = app.Services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            try
            {
                var canConnect = await dbContext.Database.CanConnectAsync();
                if (!canConnect)
                {
                    Log.Fatal("FATAL: Cannot connect to PostgreSQL database at startup.");
                    throw new InvalidOperationException("Database connection failed at startup.");
                }
                Log.Information("PostgreSQL database connection verified");
            }
            catch (Exception ex) when (ex is not InvalidOperationException)
            {
                Log.Fatal(ex, "FATAL: Failed to verify PostgreSQL database connection at startup.");
                throw;
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
