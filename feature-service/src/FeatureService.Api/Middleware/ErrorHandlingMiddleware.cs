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

        _logger.LogError(exception, "Unhandled exception occurred - RequestId: {RequestId}", requestId);

        var errorResponse = new ErrorResponse
        {
            Success = false,
            Error = new ErrorDetail
            {
                Code = "INTERNAL_ERROR",
                Message = "An internal error occurred"
            },
            Meta = new ErrorMeta
            {
                RequestId = requestId,
                Timestamp = DateTime.UtcNow
            }
        };

        var statusCode = HttpStatusCode.InternalServerError;

        switch (exception)
        {
            case ValidationException validationException:
                statusCode = HttpStatusCode.BadRequest;
                errorResponse.Error.Code = "VALIDATION_ERROR";
                errorResponse.Error.Message = "Validation failed";
                errorResponse.Error.Details = validationException.Errors
                    .Select(e => e.ErrorMessage)
                    .ToList();
                break;

            case UnauthorizedAccessException:
                statusCode = HttpStatusCode.Unauthorized;
                errorResponse.Error.Code = "UNAUTHORIZED";
                errorResponse.Error.Message = "Unauthorized access";
                break;

            case KeyNotFoundException:
                statusCode = HttpStatusCode.NotFound;
                errorResponse.Error.Code = "NOT_FOUND";
                errorResponse.Error.Message = exception.Message;
                break;

            case InvalidOperationException invalidOpEx:
                statusCode = HttpStatusCode.BadRequest;
                errorResponse.Error.Code = "INVALID_OPERATION";
                errorResponse.Error.Message = invalidOpEx.Message;
                break;
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)statusCode;

        var jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        await context.Response.WriteAsJsonAsync(errorResponse, jsonOptions);
    }
}
