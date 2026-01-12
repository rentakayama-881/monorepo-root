using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
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
    /// Get the current user ID from JWT claims
    /// </summary>
    protected uint GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("user_id")?.Value;

        return uint.TryParse(userIdClaim, out var id) ? id : 0;
    }

    /// <summary>
    /// Get the current username from JWT claims
    /// </summary>
    protected string GetUsername()
    {
        return User.FindFirst(ClaimTypes.Name)?.Value
            ?? User.FindFirst("username")?.Value
            ?? User.FindFirst("preferred_username")?.Value
            ?? "";
    }

    /// <summary>
    /// Check if user has admin role
    /// </summary>
    protected bool IsAdmin()
    {
        return User.IsInRole("admin") 
            || User.HasClaim(c => c.Type == "role" && c.Value == "admin")
            || User.HasClaim(c => c.Type == ClaimTypes.Role && c.Value == "admin");
    }

    /// <summary>
    /// Check if user has TOTP (2FA) enabled from JWT claims
    /// </summary>
    protected bool HasTwoFactorEnabled()
    {
        var totpClaim = User.FindFirst("totp_enabled")?.Value;
        return totpClaim?.Equals("true", StringComparison.OrdinalIgnoreCase) == true
            || totpClaim?.Equals("True", StringComparison.OrdinalIgnoreCase) == true;
    }

    /// <summary>
    /// Returns 403 Forbidden if user doesn't have 2FA enabled
    /// Use this for financial operations that require 2FA
    /// </summary>
    protected ObjectResult? RequiresTwoFactorAuth()
    {
        if (!HasTwoFactorEnabled())
        {
            return ApiError(403, "TWO_FACTOR_REQUIRED", 
                "Two-factor authentication (2FA) is required for financial operations. " +
                "Please enable TOTP authenticator in your security settings before proceeding.");
        }
        return null;
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
    /// Returns 400 Bad Request with standardized error (code + message)
    /// </summary>
    protected ObjectResult ApiBadRequest(string code, string message, List<string>? details = null)
    {
        return ApiError(400, code, message, details);
    }

    /// <summary>
    /// Returns 400 Bad Request with standardized error (message only, uses VALIDATION_ERROR code)
    /// </summary>
    protected ObjectResult ApiBadRequest(string message)
    {
        return ApiError(400, ApiErrorCodes.ValidationError, message);
    }

    /// <summary>
    /// Returns 401 Unauthorized with standardized error (code + message)
    /// </summary>
    protected ObjectResult ApiUnauthorized(string code, string message)
    {
        return ApiError(401, code, message);
    }

    /// <summary>
    /// Returns 404 Not Found with standardized error (code + message)
    /// </summary>
    protected ObjectResult ApiNotFound(string code, string message)
    {
        return ApiError(404, code, message);
    }

    /// <summary>
    /// Returns 201 Created with success response
    /// </summary>
    protected ObjectResult ApiCreated<T>(T data, string? message = null) where T : class
    {
        var response = new ApiResponse<T>(
            true,
            data,
            new ApiMeta(GetRequestId(), DateTime.UtcNow),
            message
        );
        return StatusCode(201, response);
    }

    /// <summary>
    /// Returns 200 OK with success response and optional message
    /// </summary>
    protected OkObjectResult ApiOk<T>(T data, string? message = null) where T : class
    {
        var response = new ApiResponse<T>(
            true,
            data,
            new ApiMeta(GetRequestId(), DateTime.UtcNow),
            message
        );
        return Ok(response);
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
