using Microsoft.EntityFrameworkCore;
using FeatureService.Api.Infrastructure.Persistence;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using FeatureService.Api.Controllers;

namespace FeatureService.Api.Services;

public interface IDocumentService
{
    Task<string> UploadDocumentAsync(uint userId, UploadDocumentRequest request);
    Task<DocumentDetailDto?> GetDocumentByIdAsync(string documentId);
    Task<DocumentAccessDto?> GetDocumentAccessAsync(string documentId);
    Task<PaginatedDocumentsResponse> GetUserDocumentsAsync(uint userId, int page, int pageSize, string? category = null);
    Task<PaginatedDocumentsResponse> GetPublicDocumentsAsync(uint userId, int page, int pageSize, string? category = null);
    Task UpdateDocumentAsync(string documentId, UpdateDocumentRequest request);
    Task UpdateDocumentSharingAsync(string documentId, List<uint> sharedWithUserIds);
    Task DeleteDocumentAsync(string documentId);
    Task<StorageQuotaDto> GetUserQuotaAsync(uint userId);
    Task IncrementDownloadCountAsync(string documentId);
    Task<byte[]?> GetDocumentFileAsync(string documentId);
}

public class DocumentService : IDocumentService
{
    private readonly AppDbContext _db;
    private readonly ILogger<DocumentService> _logger;

    public DocumentService(AppDbContext db, ILogger<DocumentService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<string> UploadDocumentAsync(uint userId, UploadDocumentRequest request)
    {
        // Validate file extension
        var extension = $".{request.FileType.ToLowerInvariant()}";
        if (!DocumentFileType.AllowedExtensions.Contains(extension))
        {
            throw new ArgumentException($"Invalid file type. Allowed types: {string.Join(", ", DocumentFileType.AllowedExtensions)}");
        }

        // Validate file size
        if (request.FileData.Length > DocumentFileType.MaxFileSizeBytes)
        {
            throw new ArgumentException($"File size exceeds maximum allowed ({DocumentFileType.MaxFileSizeBytes / 1024 / 1024} MB)");
        }

        // Check user quota
        var quota = await GetUserQuotaAsync(userId);
        if (quota.UsedBytes + request.FileData.Length > DocumentFileType.MaxUserStorageBytes)
        {
            throw new InvalidOperationException($"Storage quota exceeded. Used: {quota.UsedBytes / 1024 / 1024} MB, Max: {DocumentFileType.MaxUserStorageBytes / 1024 / 1024} MB");
        }

        // Validate category
        if (!DocumentCategory.All.Contains(request.Category))
        {
            throw new ArgumentException($"Invalid category. Allowed: {string.Join(", ", DocumentCategory.All)}");
        }

        // Determine MIME type
        var mimeType = DocumentFileType.ResolveMimeType(extension);

        var documentId = $"doc_{Ulid.NewUlid()}";
        var storagePath = $"documents/{userId}/{documentId}{extension}";

        var publicUrl = request.Visibility == DocumentVisibility.Public 
            ? $"/api/v1/documents/{documentId}/download"
            : null;

        var document = new Document
        {
            Id = documentId,
            UserId = userId,
            FileName = request.FileName,
            Title = request.Title ?? Path.GetFileNameWithoutExtension(request.FileName),
            Description = request.Description,
            FileType = request.FileType.ToLowerInvariant(),
            MimeType = mimeType,
            FileSize = request.FileData.Length,
            FileData = request.FileData,
            StoragePath = storagePath,
            PublicUrl = publicUrl,
            Visibility = request.Visibility,
            SharedWithUserIds = NormalizeSharedWith(request.SharedWithUserIds),
            Category = request.Category,
            Tags = request.Tags ?? new List<string>(),
            DownloadCount = 0,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Documents.Add(document);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Document uploaded: {DocumentId} by user {UserId}. Size: {Size} bytes", 
            document.Id, userId, request.FileData.Length);

        return documentId;
    }

    public async Task<DocumentDetailDto?> GetDocumentByIdAsync(string documentId)
    {
        var doc = await _db.Documents
            .FirstOrDefaultAsync(d => d.Id == documentId && !d.IsDeleted);

        if (doc == null) return null;

        return new DocumentDetailDto(
            doc.Id,
            doc.UserId,
            doc.Title ?? doc.FileName,
            doc.Description,
            doc.FileName,
            doc.FileType,
            doc.FileSize,
            doc.Visibility,
            doc.Category,
            doc.Tags,
            doc.DownloadCount,
            doc.CreatedAt,
            doc.UpdatedAt
        );
    }

    public async Task<DocumentAccessDto?> GetDocumentAccessAsync(string documentId)
    {
        var doc = await _db.Documents
            .Where(d => d.Id == documentId && !d.IsDeleted)
            .Select(d => new DocumentAccessDto(
                d.Id,
                d.UserId,
                d.Visibility,
                d.SharedWithUserIds,
                d.FileName,
                d.FileType
            ))
            .FirstOrDefaultAsync();

        if (doc == null) return null;

        // Older documents may not have sharedWithUserIds yet.
        if (doc.SharedWithUserIds == null)
        {
            return doc with { SharedWithUserIds = new List<uint>() };
        }

        return doc;
    }

    public async Task<PaginatedDocumentsResponse> GetUserDocumentsAsync(uint userId, int page, int pageSize, string? category = null)
    {
        var query = _db.Documents
            .Where(d => d.UserId == userId && !d.IsDeleted);

        if (!string.IsNullOrEmpty(category))
        {
            query = query.Where(d => d.Category == category);
        }

        var totalCount = await query.CountAsync();

        var documents = await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var summaries = documents.Select(d => new DocumentSummaryDto(
            d.Id,
            d.Title ?? d.FileName,
            d.Description,
            d.FileName,
            d.FileType,
            d.FileSize,
            d.Visibility,
            d.Category,
            d.Tags,
            d.DownloadCount,
            d.CreatedAt,
            d.UpdatedAt
        )).ToList();

        return new PaginatedDocumentsResponse(summaries, totalCount, page, pageSize);
    }

    public async Task<PaginatedDocumentsResponse> GetPublicDocumentsAsync(uint userId, int page, int pageSize, string? category = null)
    {
        var query = _db.Documents
            .Where(d => d.UserId == userId && d.Visibility == DocumentVisibility.Public && !d.IsDeleted);

        if (!string.IsNullOrEmpty(category))
        {
            query = query.Where(d => d.Category == category);
        }

        var totalCount = await query.CountAsync();

        var documents = await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var summaries = documents.Select(d => new DocumentSummaryDto(
            d.Id,
            d.Title ?? d.FileName,
            d.Description,
            d.FileName,
            d.FileType,
            d.FileSize,
            d.Visibility,
            d.Category,
            d.Tags,
            d.DownloadCount,
            d.CreatedAt,
            d.UpdatedAt
        )).ToList();

        return new PaginatedDocumentsResponse(summaries, totalCount, page, pageSize);
    }

    public async Task UpdateDocumentAsync(string documentId, UpdateDocumentRequest request)
    {
        var doc = await _db.Documents.FirstOrDefaultAsync(d => d.Id == documentId);
        if (doc == null) return;

        if (request.Title != null)
            doc.Title = request.Title;
        if (request.Description != null)
            doc.Description = request.Description;
        if (request.Visibility != null)
            doc.Visibility = request.Visibility;
        if (request.Category != null)
            doc.Category = request.Category;
        if (request.Tags != null)
            doc.Tags = request.Tags;

        doc.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task UpdateDocumentSharingAsync(string documentId, List<uint> sharedWithUserIds)
    {
        var normalized = NormalizeSharedWith(sharedWithUserIds);
        var doc = await _db.Documents.FirstOrDefaultAsync(d => d.Id == documentId && !d.IsDeleted);
        if (doc != null)
        {
            doc.SharedWithUserIds = normalized;
            doc.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }
    }

    public async Task DeleteDocumentAsync(string documentId)
    {
        await _db.Documents
            .Where(d => d.Id == documentId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(d => d.IsDeleted, true)
                .SetProperty(d => d.UpdatedAt, DateTime.UtcNow));

        _logger.LogInformation("Document deleted: {DocumentId}", documentId);
    }

    public async Task<StorageQuotaDto> GetUserQuotaAsync(uint userId)
    {
        var documents = await _db.Documents
            .Where(d => d.UserId == userId && !d.IsDeleted)
            .Select(d => d.FileSize)
            .ToListAsync();

        var usedBytes = documents.Sum(s => (long)s);
        var maxBytes = DocumentFileType.MaxUserStorageBytes;
        var usedPercentage = (decimal)usedBytes / maxBytes * 100m;

        return new StorageQuotaDto(usedBytes, maxBytes, documents.Count, Math.Round(usedPercentage, 2));
    }

    public async Task IncrementDownloadCountAsync(string documentId)
    {
        var doc = await _db.Documents.FirstOrDefaultAsync(d => d.Id == documentId);
        if (doc != null)
        {
            doc.DownloadCount++;
            await _db.SaveChangesAsync();
        }
    }

    public async Task<byte[]?> GetDocumentFileAsync(string documentId)
    {
        var doc = await _db.Documents
            .FirstOrDefaultAsync(d => d.Id == documentId && !d.IsDeleted);

        return doc?.FileData;
    }

    private static List<uint> NormalizeSharedWith(IEnumerable<uint>? userIds)
    {
        if (userIds == null) return new List<uint>();

        // Defensive: ensure > 0, distinct, stable order, reasonable limit.
        var normalized = userIds
            .Where(id => id > 0)
            .Distinct()
            .Take(100)
            .ToList();

        return normalized;
    }
}
