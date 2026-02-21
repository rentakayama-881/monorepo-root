using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Controllers;

public abstract class ApiControllerBase : ControllerBase
{
    protected const string InvalidCachedIdempotencyResultMessage =
        "Data idempotency tidak valid. Permintaan diblokir untuk mencegah duplikasi transaksi.";

    protected string GetRequestId()
    {
        return HttpContext.Items["RequestId"]?.ToString() ?? Guid.NewGuid().ToString();
    }

    protected uint GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("user_id")?.Value;

        return uint.TryParse(userIdClaim, out var id) ? id : 0;
    }

    protected string GetUsername()
    {
        return User.FindFirst(ClaimTypes.Name)?.Value
            ?? User.FindFirst("name")?.Value
            ?? User.FindFirst("username")?.Value
            ?? User.FindFirst("preferred_username")?.Value
            ?? "";
    }

    protected bool IsAdmin()
    {
        var isAdminToken = string.Equals(
            User.FindFirst("type")?.Value,
            "admin",
            StringComparison.OrdinalIgnoreCase);
        if (!isAdminToken) return false;

        return User.IsInRole("admin")
            || User.HasClaim(c => c.Type == "role" && c.Value == "admin")
            || User.HasClaim(c => c.Type == ClaimTypes.Role && c.Value == "admin");
    }

    protected bool HasTwoFactorEnabled()
    {
        var totpClaim = User.FindFirst("totp_enabled")?.Value;
        return totpClaim?.Equals("true", StringComparison.OrdinalIgnoreCase) == true;
    }

    /// <summary>
    /// Returns 403 if 2FA not enabled — use for financial operations.
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

    protected ObjectResult ApiError(int statusCode, string code, string message, List<string>? details = null)
    {
        var response = new ApiErrorResponse(code, message, details, GetRequestId());
        return StatusCode(statusCode, response);
    }

    protected ObjectResult ApiBadRequest(string code, string message, List<string>? details = null)
        => ApiError(400, code, message, details);

    protected ObjectResult ApiBadRequest(string message)
        => ApiError(400, ApiErrorCodes.ValidationError, message);

    protected ObjectResult ApiUnauthorized(string code, string message)
        => ApiError(401, code, message);

    protected ObjectResult ApiUnauthorized(string message = "Unauthorized access")
        => ApiError(401, ApiErrorCodes.Unauthorized, message);

    protected ObjectResult ApiNotFound(string code, string message)
        => ApiError(404, code, message);

    protected ObjectResult ApiNotFound(string message = "Resource not found")
        => ApiError(404, ApiErrorCodes.NotFound, message);

    protected ObjectResult ApiForbidden(string message = "Access denied")
        => ApiError(403, ApiErrorCodes.Forbidden, message);

    protected ObjectResult ApiConflict(string message)
        => ApiError(409, ApiErrorCodes.Conflict, message);

    protected ObjectResult ApiIdempotencyStateInvalid(string? message = null)
        => ApiError(409, ApiErrorCodes.IdempotencyStateInvalid, message ?? InvalidCachedIdempotencyResultMessage);

    protected static bool IsInvalidCachedIdempotencyResult(string? message)
        => string.Equals(
            message?.Trim(),
            InvalidCachedIdempotencyResultMessage,
            StringComparison.Ordinal);

    protected ObjectResult ApiPayloadTooLarge(string message)
        => ApiError(413, ApiErrorCodes.PayloadTooLarge, message);

    protected ObjectResult ApiTooManyRequests(string message)
        => ApiError(429, ApiErrorCodes.TooManyRequests, message);

    protected ObjectResult ApiInternalError(string message = "An internal error occurred")
        => ApiError(500, ApiErrorCodes.InternalError, message);

    protected ObjectResult ApiServiceUnavailable(string message = "Service temporarily unavailable")
        => ApiError(503, ApiErrorCodes.ServiceUnavailable, message);

    protected ObjectResult ApiCreated<T>(T data, string? message = null) where T : class
    {
        var response = new ApiResponse<T>(
            true, data, new ApiMeta(GetRequestId(), DateTime.UtcNow), message);
        return StatusCode(201, response);
    }

    protected OkObjectResult ApiOk<T>(T data, string? message = null) where T : class
    {
        var response = new ApiResponse<T>(
            true, data, new ApiMeta(GetRequestId(), DateTime.UtcNow), message);
        return Ok(response);
    }

    protected OkObjectResult ApiOk<T>(T data) where T : class
    {
        var response = new ApiResponse<T>(
            true, data, new ApiMeta(GetRequestId(), DateTime.UtcNow));
        return Ok(response);
    }
}
