using System.ComponentModel.DataAnnotations;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.DTOs;

// =====================
// DISPUTE REQUEST DTOs
// =====================

public record CreateDisputeRequest(
    [Required]
    string TransferId,
    
    [Required]
    [StringLength(1000, MinimumLength = 20)]
    string Reason,
    
    [Required]
    DisputeCategory Category
);

public record AddDisputeMessageRequest(
    [Required]
    [StringLength(2000, MinimumLength = 1)]
    string Content
);

public record AddDisputeEvidenceRequest(
    [Required]
    string Type, // "image", "document", "screenshot"
    
    [Required]
    string Url,
    
    string? Description
);

public record ResolveDisputeRequest(
    [Required]
    ResolutionType Type,
    
    // Percentage to refund to sender (0-100). Used when Type is Split.
    int? SenderPercent,
    
    string? Note
);

// =====================
// DISPUTE RESPONSE DTOs
// =====================

public record DisputeDto(
    string Id,
    string TransferId,
    uint InitiatorId,
    string InitiatorUsername,
    uint RespondentId,
    string RespondentUsername,
    // Transfer party info - who is sender/receiver
    uint SenderId,
    string SenderUsername,
    uint ReceiverId,
    string ReceiverUsername,
    string Reason,
    string Category,
    string Status,
    long Amount,
    List<DisputeEvidenceDto> Evidence,
    List<DisputeMessageDto> Messages,
    DisputeResolutionDto? Resolution,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DateTime? ResolvedAt
);

public record DisputeEvidenceDto(
    string Type,
    string Url,
    string? Description,
    DateTime UploadedAt,
    uint UploadedById
);

public record DisputeMessageDto(
    string Id,
    uint SenderId,
    string SenderUsername,
    bool IsAdmin,
    string Content,
    DateTime SentAt
);

public record DisputeResolutionDto(
    string Type,
    long RefundToSender,
    long ReleaseToReceiver,
    string? Note
);

public record CreateDisputeResponse(
    bool Success,
    string? DisputeId,
    string? Error
);

public record DisputeListResponse(
    List<DisputeSummaryDto> Disputes,
    int Total
);

public record DisputeSummaryDto(
    string Id,
    string TransferId,
    string InitiatorUsername,
    string RespondentUsername,
    string Category,
    string Status,
    long Amount,
    DateTime CreatedAt
);
