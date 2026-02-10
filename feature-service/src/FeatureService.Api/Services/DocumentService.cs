using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using FeatureService.Api.Controllers;
using Ulid = NUlid.Ulid;

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
    private readonly MongoDbContext _context;
    private readonly ILogger<DocumentService> _logger;
    private readonly IConfiguration _configuration;

    public DocumentService(MongoDbContext context, ILogger<DocumentService> logger, IConfiguration configuration)
    {
        _context = context;
        _logger = logger;
        _configuration = configuration;
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
        var mimeType = extension switch
        {
            ".pdf" => "application/pdf",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            _ => "application/octet-stream"
        };

        var documentId = $"doc_{Ulid.NewUlid()}";
        var storagePath = $"documents/{userId}/{documentId}{extension}";

        // TODO: Upload to Supabase Storage
        // For now, store file data in MongoDB (GridFS should be used for production)
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
            FileData = request.FileData, // Store in document for simplicity
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

        await _context.Documents.InsertOneAsync(document);
        _logger.LogInformation("Document uploaded: {DocumentId} by user {UserId}. Size: {Size} bytes", 
            document.Id, userId, request.FileData.Length);

        return documentId;
    }

    public async Task<DocumentDetailDto?> GetDocumentByIdAsync(string documentId)
    {
        var doc = await _context.Documents
            .Find(d => d.Id == documentId && !d.IsDeleted)
            .FirstOrDefaultAsync();

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
        var doc = await _context.Documents
            .Find(d => d.Id == documentId && !d.IsDeleted)
            .Project(d => new DocumentAccessDto(
                d.Id,
                d.UserId,
                d.Visibility,
                d.SharedWithUserIds,
                d.FileName,
                d.FileType
            ))
            .FirstOrDefaultAsync();

        if (doc == null) return null;

        // Older documents may not have sharedWithUserIds in MongoDB yet.
        if (doc.SharedWithUserIds == null)
        {
            return doc with { SharedWithUserIds = new List<uint>() };
        }

        return doc;
    }

    public async Task<PaginatedDocumentsResponse> GetUserDocumentsAsync(uint userId, int page, int pageSize, string? category = null)
    {
        var filterBuilder = Builders<Document>.Filter;
        var filter = filterBuilder.And(
            filterBuilder.Eq(d => d.UserId, userId),
            filterBuilder.Eq(d => d.IsDeleted, false)
        );

        if (!string.IsNullOrEmpty(category))
        {
            filter = filterBuilder.And(filter, filterBuilder.Eq(d => d.Category, category));
        }

        var totalCount = await _context.Documents.CountDocumentsAsync(filter);

        var documents = await _context.Documents
            .Find(filter)
            .SortByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
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

        return new PaginatedDocumentsResponse(summaries, (int)totalCount, page, pageSize);
    }

    public async Task<PaginatedDocumentsResponse> GetPublicDocumentsAsync(uint userId, int page, int pageSize, string? category = null)
    {
        var filterBuilder = Builders<Document>.Filter;
        var filter = filterBuilder.And(
            filterBuilder.Eq(d => d.UserId, userId),
            filterBuilder.Eq(d => d.Visibility, DocumentVisibility.Public),
            filterBuilder.Eq(d => d.IsDeleted, false)
        );

        if (!string.IsNullOrEmpty(category))
        {
            filter = filterBuilder.And(filter, filterBuilder.Eq(d => d.Category, category));
        }

        var totalCount = await _context.Documents.CountDocumentsAsync(filter);

        var documents = await _context.Documents
            .Find(filter)
            .SortByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
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

        return new PaginatedDocumentsResponse(summaries, (int)totalCount, page, pageSize);
    }

    public async Task UpdateDocumentAsync(string documentId, UpdateDocumentRequest request)
    {
        var updateBuilder = Builders<Document>.Update.Set(d => d.UpdatedAt, DateTime.UtcNow);

        if (request.Title != null)
            updateBuilder = updateBuilder.Set(d => d.Title, request.Title);
        if (request.Description != null)
            updateBuilder = updateBuilder.Set(d => d.Description, request.Description);
        if (request.Visibility != null)
            updateBuilder = updateBuilder.Set(d => d.Visibility, request.Visibility);
        if (request.Category != null)
            updateBuilder = updateBuilder.Set(d => d.Category, request.Category);
        if (request.Tags != null)
            updateBuilder = updateBuilder.Set(d => d.Tags, request.Tags);

        await _context.Documents.UpdateOneAsync(d => d.Id == documentId, updateBuilder);
    }

    public async Task UpdateDocumentSharingAsync(string documentId, List<uint> sharedWithUserIds)
    {
        var normalized = NormalizeSharedWith(sharedWithUserIds);
        var update = Builders<Document>.Update
            .Set(d => d.SharedWithUserIds, normalized)
            .Set(d => d.UpdatedAt, DateTime.UtcNow);

        await _context.Documents.UpdateOneAsync(d => d.Id == documentId && !d.IsDeleted, update);
    }

    public async Task DeleteDocumentAsync(string documentId)
    {
        var update = Builders<Document>.Update
            .Set(d => d.IsDeleted, true)
            .Set(d => d.UpdatedAt, DateTime.UtcNow);

        await _context.Documents.UpdateOneAsync(d => d.Id == documentId, update);
        _logger.LogInformation("Document deleted: {DocumentId}", documentId);
    }

    public async Task<StorageQuotaDto> GetUserQuotaAsync(uint userId)
    {
        var documents = await _context.Documents
            .Find(d => d.UserId == userId && !d.IsDeleted)
            .ToListAsync();

        var usedBytes = documents.Sum(d => d.FileSize);
        var maxBytes = DocumentFileType.MaxUserStorageBytes;
        var usedPercentage = (double)usedBytes / maxBytes * 100;

        return new StorageQuotaDto(usedBytes, maxBytes, documents.Count, Math.Round(usedPercentage, 2));
    }

    public async Task IncrementDownloadCountAsync(string documentId)
    {
        var update = Builders<Document>.Update.Inc(d => d.DownloadCount, 1);
        await _context.Documents.UpdateOneAsync(d => d.Id == documentId, update);
    }

    public async Task<byte[]?> GetDocumentFileAsync(string documentId)
    {
        var doc = await _context.Documents
            .Find(d => d.Id == documentId && !d.IsDeleted)
            .FirstOrDefaultAsync();

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
