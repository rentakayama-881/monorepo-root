namespace FeatureService.Api.DTOs;

// ================== Document DTOs ==================

/// <summary>
/// Request to upload a document
/// </summary>
public record UploadDocumentRequest(
    string FileName,
    string FileType,    // pdf, docx
    byte[] FileData,
    string? Title,
    string? Description,
    string Category,    // whitepaper, article, research, other
    string Visibility,  // public, private
    List<string>? Tags,
    List<uint>? SharedWithUserIds = null
);

/// <summary>
/// Response after uploading a document
/// </summary>
public record UploadDocumentResponse(
    string DocumentId,
    string Title,
    string FileName,
    string FileType,
    long FileSize,
    string PublicUrl,
    string Message
);

/// <summary>
/// Document summary for listing
/// </summary>
public record DocumentSummaryDto(
    string Id,
    string Title,
    string? Description,
    string FileName,
    string FileType,
    long FileSize,
    string Visibility,
    string Category,
    List<string> Tags,
    int DownloadCount,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

/// <summary>
/// Full document details
/// </summary>
public record DocumentDetailDto(
    string Id,
    uint UserId,
    string Title,
    string? Description,
    string FileName,
    string FileType,
    long FileSize,
    string Visibility,
    string Category,
    List<string> Tags,
    int DownloadCount,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

/// <summary>
/// Minimal document fields for authorization checks (excludes FileData)
/// </summary>
public record DocumentAccessDto(
    string Id,
    uint UserId,
    string Visibility,
    List<uint>? SharedWithUserIds,
    string FileName,
    string FileType
);

/// <summary>
/// Request to update document metadata
/// </summary>
public record UpdateDocumentRequest(
    string? Title,
    string? Description,
    string? Visibility,
    string? Category,
    List<string>? Tags
);

/// <summary>
/// Request to update private document sharing list
/// </summary>
public record UpdateDocumentSharingRequest(
    List<uint> SharedWithUserIds
);

/// <summary>
/// User's document storage quota
/// </summary>
public record StorageQuotaDto(
    long UsedBytes,
    long MaxBytes,
    int DocumentCount,
    double UsedPercentage
);

/// <summary>
/// User documents list response
/// </summary>
public record UserDocumentsResponse(
    List<DocumentSummaryDto> Documents,
    StorageQuotaDto Quota,
    int TotalCount
);

/// <summary>
/// Public profile documents response
/// </summary>
public record PublicDocumentsResponse(
    List<DocumentSummaryDto> Documents,
    int TotalCount
);

/// <summary>
/// Paginated documents response
/// </summary>
public record PaginatedDocumentsResponse(
    List<DocumentSummaryDto> Documents,
    int TotalCount,
    int Page,
    int PageSize
);
