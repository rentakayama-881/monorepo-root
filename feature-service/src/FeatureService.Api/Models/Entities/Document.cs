namespace FeatureService.Api.Models.Entities;

/// <summary>
/// Represents a document stored in user's profile.
/// Documents are standalone files like white papers, articles, research papers.
/// </summary>
public class Document
{
    public string Id { get; set; } = string.Empty; // doc_xxx format using Ulid

    /// <summary>
    /// User ID who owns this document
    /// </summary>
    public uint UserId { get; set; }

    /// <summary>
    /// Original filename
    /// </summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>
    /// Display title for the document
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Optional description
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// File type: pdf, docx, txt, md, csv, xlsx, xls, zip
    /// </summary>
    public string FileType { get; set; } = string.Empty;

    /// <summary>
    /// MIME type
    /// </summary>
    public string MimeType { get; set; } = string.Empty;

    /// <summary>
    /// File size in bytes
    /// </summary>
    public long FileSize { get; set; }

    /// <summary>
    /// Storage path/key in object storage (Supabase)
    /// </summary>
    public string StoragePath { get; set; } = string.Empty;

    /// <summary>
    /// Public URL for download
    /// </summary>
    public string? PublicUrl { get; set; }

    /// <summary>
    /// Visibility: public or private
    /// </summary>
    public string Visibility { get; set; } = DocumentVisibility.Private;

    /// <summary>
    /// Explicit share list for private documents (in addition to owner/admin).
    /// Used for Validation Case workflows (Artifact Submission, arbitration access).
    /// </summary>
    public List<uint> SharedWithUserIds { get; set; } = new();

    /// <summary>
    /// Document category: whitepaper, article, research, other
    /// </summary>
    public string Category { get; set; } = DocumentCategory.Other;

    /// <summary>
    /// Tags for organization
    /// </summary>
    public List<string> Tags { get; set; } = new();

    /// <summary>
    /// Download count
    /// </summary>
    public int DownloadCount { get; set; } = 0;

    /// <summary>
    /// Whether the document is soft deleted
    /// </summary>
    public bool IsDeleted { get; set; } = false;

    /// <summary>
    /// File data stored in the database (consider external storage for production)
    /// </summary>
    public byte[]? FileData { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Document visibility options
/// </summary>
public static class DocumentVisibility
{
    public const string Public = "public";
    public const string Private = "private";

    public static readonly IReadOnlyList<string> All = new[] { Public, Private };
}

/// <summary>
/// Document categories
/// </summary>
public static class DocumentCategory
{
    public const string Whitepaper = "whitepaper";
    public const string Article = "article";
    public const string Research = "research";
    public const string Other = "other";

    public static readonly string[] All = { Whitepaper, Article, Research, Other };
}

/// <summary>
/// Allowed file types
/// </summary>
public static class DocumentFileType
{
    public const string Pdf = "pdf";
    public const string Docx = "docx";
    public const string Txt = "txt";
    public const string Md = "md";
    public const string Csv = "csv";
    public const string Xlsx = "xlsx";
    public const string Xls = "xls";
    public const string Zip = "zip";

    public static readonly string[] AllowedExtensions = { ".pdf", ".docx", ".txt", ".md", ".csv", ".xlsx", ".xls", ".zip" };
    public static readonly string[] AllowedMimeTypes = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/markdown",
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/zip"
    };

    public const long MaxFileSizeBytes = 500L * 1024 * 1024; // 500 MB
    public const long MaxUserStorageBytes = 5L * 1024 * 1024 * 1024; // 5 GB per user

    public static string ResolveMimeType(string extension)
    {
        return extension.ToLowerInvariant() switch
        {
            ".pdf" => "application/pdf",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".txt" => "text/plain",
            ".md" => "text/markdown",
            ".csv" => "text/csv",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xls" => "application/vnd.ms-excel",
            ".zip" => "application/zip",
            _ => "application/octet-stream"
        };
    }
}
