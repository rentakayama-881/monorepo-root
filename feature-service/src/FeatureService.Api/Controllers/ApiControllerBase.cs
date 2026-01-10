using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Controllers;

/// <summary>
/// Base controller with common helper methods for standardized API responses
/// </summary>
public abstract class ApiControllerBase : ControllerBase
{
    /// <summary>
    /// Get the current request ID from the context
    /// </summary>
    protected string GetRequestId()
    {
        return HttpContext.Items["RequestId"]?.ToString() ?? Guid.NewGuid().ToString();
    }

    /// <summary>
    /// Create a standardized error response
    /// </summary>
    protected ObjectResult ApiError(int statusCode, string code, string message, List<string>? details = null)
    {
        var response = new ApiErrorResponse(code, message, details, GetRequestId());
        return StatusCode(statusCode, response);
    }

    /// <summary>
    /// Returns 400 Bad Request with standardized error
    /// </summary>
    protected ObjectResult ApiBadRequest(string message, List<string>? details = null)
    {
        return ApiError(400, ApiErrorCodes.BadRequest, message, details);
    }

    /// <summary>
    /// Returns 401 Unauthorized with standardized error
    /// </summary>
    protected ObjectResult ApiUnauthorized(string message = "Unauthorized access")
    {
        return ApiError(401, ApiErrorCodes.Unauthorized, message);
    }

    /// <summary>
    /// Returns 403 Forbidden with standardized error
    /// </summary>
    protected ObjectResult ApiForbidden(string message = "Access denied")
    {
        return ApiError(403, ApiErrorCodes.Forbidden, message);
    }

    /// <summary>
    /// Returns 404 Not Found with standardized error
    /// </summary>
    protected ObjectResult ApiNotFound(string message = "Resource not found")
    {
        return ApiError(404, ApiErrorCodes.NotFound, message);
    }

    /// <summary>
    /// Returns 409 Conflict with standardized error
    /// </summary>
    protected ObjectResult ApiConflict(string message)
    {
        return ApiError(409, ApiErrorCodes.Conflict, message);
    }

    /// <summary>
    /// Returns 413 Payload Too Large with standardized error
    /// </summary>
    protected ObjectResult ApiPayloadTooLarge(string message)
    {
        return ApiError(413, ApiErrorCodes.PayloadTooLarge, message);
    }

    /// <summary>
    /// Returns 429 Too Many Requests with standardized error
    /// </summary>
    protected ObjectResult ApiTooManyRequests(string message)
    {
        return ApiError(429, ApiErrorCodes.TooManyRequests, message);
    }

    /// <summary>
    /// Returns 500 Internal Server Error with standardized error
    /// </summary>
    protected ObjectResult ApiInternalError(string message = "An internal error occurred")
    {
        return ApiError(500, ApiErrorCodes.InternalError, message);
    }

    /// <summary>
    /// Returns 503 Service Unavailable with standardized error
    /// </summary>
    protected ObjectResult ApiServiceUnavailable(string message = "Service temporarily unavailable")
    {
        return ApiError(503, ApiErrorCodes.ServiceUnavailable, message);
    }

    /// <summary>
    /// Wrap success response with metadata
    /// </summary>
    protected OkObjectResult ApiOk<T>(T data) where T : class
    {
        var response = new ApiResponse<T>(
            true,
            data,
            new ApiMeta(GetRequestId(), DateTime.UtcNow)
        );
        return Ok(response);
    }
}
