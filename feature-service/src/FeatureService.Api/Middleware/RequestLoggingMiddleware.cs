using Serilog;

namespace FeatureService.Api.Middleware;

public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;

    public RequestLoggingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var requestId = context.Items["RequestId"]?.ToString() ?? "unknown";
        
        Log.Information("HTTP {Method} {Path} started - RequestId: {RequestId}",
            context.Request.Method,
            context.Request.Path,
            requestId);

        var startTime = DateTime.UtcNow;

        await _next(context);

        var duration = DateTime.UtcNow - startTime;

        Log.Information("HTTP {Method} {Path} completed with {StatusCode} in {Duration}ms - RequestId: {RequestId}",
            context.Request.Method,
            context.Request.Path,
            context.Response.StatusCode,
            duration.TotalMilliseconds,
            requestId);
    }
}
