using System.Net;
using System.Text.Json;
using FeatureService.Api.DTOs;
using FluentValidation;

namespace FeatureService.Api.Middleware;

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var requestId = context.Items["RequestId"]?.ToString() ?? Guid.NewGuid().ToString();

        var statusCode = HttpStatusCode.InternalServerError;
        var errorCode = ApiErrorCodes.InternalError;
        var errorMessage = "Terjadi kesalahan internal";
        List<string>? details = null;

        switch (exception)
        {
            case ValidationException validationException:
                statusCode = HttpStatusCode.BadRequest;
                errorCode = ApiErrorCodes.ValidationError;
                errorMessage = "Validasi gagal";
                details = validationException.Errors
                    .Select(e => e.ErrorMessage)
                    .ToList();
                _logger.LogWarning("Validation failed - RequestId: {RequestId}, Errors: {Errors}", 
                    requestId, string.Join(", ", details));
                break;

            case UnauthorizedAccessException:
                statusCode = HttpStatusCode.Unauthorized;
                errorCode = ApiErrorCodes.Unauthorized;
                errorMessage = exception.Message;
                _logger.LogWarning("Unauthorized access - RequestId: {RequestId}", requestId);
                break;

            case KeyNotFoundException:
                statusCode = HttpStatusCode.NotFound;
                errorCode = ApiErrorCodes.NotFound;
                errorMessage = exception.Message;
                _logger.LogWarning("Resource not found - RequestId: {RequestId}, Message: {Message}", 
                    requestId, exception.Message);
                break;

            case InvalidOperationException invalidOpEx:
                statusCode = HttpStatusCode.BadRequest;
                errorCode = ApiErrorCodes.BadRequest;
                errorMessage = invalidOpEx.Message;
                _logger.LogWarning("Invalid operation - RequestId: {RequestId}, Message: {Message}", 
                    requestId, exception.Message);
                break;

            case ArgumentException argEx:
                statusCode = HttpStatusCode.BadRequest;
                errorCode = ApiErrorCodes.BadRequest;
                errorMessage = argEx.Message;
                _logger.LogWarning("Invalid argument - RequestId: {RequestId}, Message: {Message}", 
                    requestId, exception.Message);
                break;

            default:
                _logger.LogError(exception, "Unhandled exception - RequestId: {RequestId}", requestId);
                break;
        }

        var errorResponse = new ApiErrorResponse(errorCode, errorMessage, details, requestId);

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        await context.Response.WriteAsJsonAsync(errorResponse, jsonOptions);
    }
}
