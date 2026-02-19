using System.ComponentModel.DataAnnotations;

namespace FeatureService.Api.DTOs;

public record ReserveMarketPurchaseRequest(
    [Required]
    [StringLength(128, MinimumLength = 4)]
    string OrderId,

    [Range(1, 500000000, ErrorMessage = "amountIdr harus lebih dari 0")]
    long AmountIdr,

    [StringLength(200)]
    string? Description,

    [StringLength(64)]
    string? ReferenceType
);

public record CaptureMarketPurchaseRequest(
    [Required]
    [StringLength(128, MinimumLength = 4)]
    string OrderId,

    [StringLength(200)]
    string? Reason
);

public record ReleaseMarketPurchaseRequest(
    [Required]
    [StringLength(128, MinimumLength = 4)]
    string OrderId,

    [StringLength(200)]
    string? Reason
);
