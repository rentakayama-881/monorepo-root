using Serilog.Context;

namespace FeatureService.Api.Middleware;

public class CorrelationIdMiddleware
{
    private readonly RequestDelegate _next;
    private const string CorrelationIdHeader = "X-Request-Id";

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[CorrelationIdHeader].FirstOrDefault()
            ?? Guid.NewGuid().ToString();

        context.Items["RequestId"] = correlationId;
        context.Response.Headers.Append(CorrelationIdHeader, correlationId);

        // Enrich Serilog context so all log entries include the request ID
        using (LogContext.PushProperty("RequestId", correlationId))
        using (LogContext.PushProperty("Service", "feature-service"))
        {
            await _next(context);
        }
    }
}
