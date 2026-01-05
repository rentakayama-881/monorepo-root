namespace FeatureService.Api.DTOs;

public class ErrorResponse
{
    public bool Success { get; set; } = false;
    public ErrorDetail Error { get; set; } = new();
    public ErrorMeta Meta { get; set; } = new();
}

public class ErrorDetail
{
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public List<string>? Details { get; set; }
}

public class ErrorMeta
{
    public string RequestId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}
