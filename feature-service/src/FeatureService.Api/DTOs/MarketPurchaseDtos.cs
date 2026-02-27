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

public record DistributeMarketPurchaseRecipient(
    [Range(1, uint.MaxValue, ErrorMessage = "userId tidak valid")]
    uint UserId,

    [Range(1, 500000000, ErrorMessage = "amountIdr harus lebih dari 0")]
    long AmountIdr
);

public record DistributeMarketPurchaseRequest(
    [Required]
    [StringLength(128, MinimumLength = 4)]
    string OrderId,

    [Required]
    [MinLength(1, ErrorMessage = "recipients minimal 1")]
    List<DistributeMarketPurchaseRecipient> Recipients,

    [StringLength(200)]
    string? Reason,

    [StringLength(64)]
    string? ReferenceType
);

public record MarketPurchaseHistoryItem(
    string OrderId,
    uint UserId,
    long AmountIdr,
    string Status,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? CapturedAt,
    DateTime? ReleasedAt
);

public record GetMarketPurchaseHistoryResponse(
    List<MarketPurchaseHistoryItem> Items,
    int Total,
    int Page,
    int PageSize
);
