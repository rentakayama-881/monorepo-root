namespace FeatureService.Api.DTOs;

/// <summary>
/// Standard API response wrapper for successful responses
/// </summary>
public record ApiResponse<T>(
    bool Success,
    T? Data,
    ApiMeta Meta,
    string? Message = null
) where T : class;

/// <summary>
/// Standard API error response
/// </summary>
public record ApiErrorResponse(
    bool Success,
    ApiError Error,
    ApiMeta Meta
)
{
    public ApiErrorResponse(string code, string message, string requestId) : this(
        false,
        new ApiError(code, message, null),
        new ApiMeta(requestId, DateTime.UtcNow)
    ) { }
    
    public ApiErrorResponse(string code, string message, List<string>? details, string requestId) : this(
        false,
        new ApiError(code, message, details),
        new ApiMeta(requestId, DateTime.UtcNow)
    ) { }
}

/// <summary>
/// API error details
/// </summary>
public record ApiError(
    string Code,
    string Message,
    List<string>? Details = null
);

/// <summary>
/// API response metadata
/// </summary>
public record ApiMeta(
    string RequestId,
    DateTime Timestamp
);

/// <summary>
/// Standard error codes for consistent API responses
/// </summary>
public static class ApiErrorCodes
{
    public const string BadRequest = "BAD_REQUEST";
    public const string Unauthorized = "UNAUTHORIZED";
    public const string Forbidden = "FORBIDDEN";
    public const string NotFound = "NOT_FOUND";
    public const string Conflict = "CONFLICT";
    public const string ValidationError = "VALIDATION_ERROR";
    public const string InternalError = "INTERNAL_ERROR";
    public const string ServiceUnavailable = "SERVICE_UNAVAILABLE";
    public const string TooManyRequests = "TOO_MANY_REQUESTS";
    public const string PayloadTooLarge = "PAYLOAD_TOO_LARGE";
    public const string PinLocked = "PIN_LOCKED";
    public const string InsufficientBalance = "INSUFFICIENT_BALANCE";
    public const string InvalidPin = "INVALID_PIN";
}
