using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using NUlid;

namespace FeatureService.Api.Services;

public interface IDocumentService
{
    Task<Document> UploadDocumentAsync(uint userId, Stream fileStream, string fileName, UploadDocumentRequest request);
    Task<Document?> GetDocumentByIdAsync(string documentId);
    Task<UserDocumentsResponse> GetUserDocumentsAsync(uint userId);
    Task<PublicDocumentsResponse> GetPublicDocumentsByUserAsync(uint userId);
    Task<Document> UpdateDocumentAsync(string documentId, uint userId, UpdateDocumentRequest request);
    Task DeleteDocumentAsync(string documentId, uint userId);
    Task<StorageQuotaDto> GetUserQuotaAsync(uint userId);
    Task IncrementDownloadCountAsync(string documentId);
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

    public async Task<Document> UploadDocumentAsync(uint userId, Stream fileStream, string fileName, UploadDocumentRequest request)
    {
        // Validate file extension
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        if (!DocumentFileType.AllowedExtensions.Contains(extension))
        {
            throw new ArgumentException($"Invalid file type. Allowed types: {string.Join(", ", DocumentFileType.AllowedExtensions)}");
        }

        // Validate file size
        if (fileStream.Length > DocumentFileType.MaxFileSizeBytes)
        {
            throw new ArgumentException($"File size exceeds maximum allowed ({DocumentFileType.MaxFileSizeBytes / 1024 / 1024} MB)");
        }

        // Check user quota
        var quota = await GetUserQuotaAsync(userId);
        if (quota.UsedBytes + fileStream.Length > DocumentFileType.MaxUserStorageBytes)
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
        // For now, we'll store the path and assume upload is handled separately
        var publicUrl = $"{_configuration["Supabase:Url"]}/storage/v1/object/public/{_configuration["Supabase:Bucket"]}/{storagePath}";

        var document = new Document
        {
            Id = documentId,
            UserId = userId,
            FileName = fileName,
            Title = request.Title,
            Description = request.Description,
            FileType = extension.TrimStart('.'),
            MimeType = mimeType,
            FileSize = fileStream.Length,
            StoragePath = storagePath,
            PublicUrl = request.Visibility == DocumentVisibility.Public ? publicUrl : null,
            Visibility = request.Visibility,
            Category = request.Category,
            Tags = request.Tags ?? new List<string>(),
            DownloadCount = 0,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _context.Documents.InsertOneAsync(document);
        _logger.LogInformation("Document uploaded: {DocumentId} by user {UserId}. Size: {Size} bytes", 
            document.Id, userId, fileStream.Length);

        return document;
    }

    public async Task<Document?> GetDocumentByIdAsync(string documentId)
    {
        return await _context.Documents
            .Find(d => d.Id == documentId && !d.IsDeleted)
            .FirstOrDefaultAsync();
    }

    public async Task<UserDocumentsResponse> GetUserDocumentsAsync(uint userId)
    {
        var documents = await _context.Documents
            .Find(d => d.UserId == userId && !d.IsDeleted)
            .SortByDescending(d => d.CreatedAt)
            .ToListAsync();

        var quota = await GetUserQuotaAsync(userId);

        var summaries = documents.Select(d => new DocumentSummaryDto(
            d.Id,
            d.Title,
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

        return new UserDocumentsResponse(summaries, quota, documents.Count);
    }

    public async Task<PublicDocumentsResponse> GetPublicDocumentsByUserAsync(uint userId)
    {
        var documents = await _context.Documents
            .Find(d => d.UserId == userId && d.Visibility == DocumentVisibility.Public && !d.IsDeleted)
            .SortByDescending(d => d.CreatedAt)
            .ToListAsync();

        var summaries = documents.Select(d => new DocumentSummaryDto(
            d.Id,
            d.Title,
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

        return new PublicDocumentsResponse(summaries, documents.Count);
    }

    public async Task<Document> UpdateDocumentAsync(string documentId, uint userId, UpdateDocumentRequest request)
    {
        var document = await GetDocumentByIdAsync(documentId);
        if (document == null)
        {
            throw new KeyNotFoundException("Document not found");
        }

        if (document.UserId != userId)
        {
            throw new UnauthorizedAccessException("You don't have permission to update this document");
        }

        var updateBuilder = Builders<Document>.Update.Set(d => d.UpdatedAt, DateTime.UtcNow);

        if (request.Title != null)
            updateBuilder = updateBuilder.Set(d => d.Title, request.Title);
        if (request.Description != null)
            updateBuilder = updateBuilder.Set(d => d.Description, request.Description);
        if (request.Visibility != null)
        {
            updateBuilder = updateBuilder.Set(d => d.Visibility, request.Visibility);
            // Update public URL based on visibility
            if (request.Visibility == DocumentVisibility.Public)
            {
                var publicUrl = $"{_configuration["Supabase:Url"]}/storage/v1/object/public/{_configuration["Supabase:Bucket"]}/{document.StoragePath}";
                updateBuilder = updateBuilder.Set(d => d.PublicUrl, publicUrl);
            }
            else
            {
                updateBuilder = updateBuilder.Set(d => d.PublicUrl, (string?)null);
            }
        }
        if (request.Category != null)
        {
            if (!DocumentCategory.All.Contains(request.Category))
            {
                throw new ArgumentException($"Invalid category. Allowed: {string.Join(", ", DocumentCategory.All)}");
            }
            updateBuilder = updateBuilder.Set(d => d.Category, request.Category);
        }
        if (request.Tags != null)
            updateBuilder = updateBuilder.Set(d => d.Tags, request.Tags);

        await _context.Documents.UpdateOneAsync(d => d.Id == documentId, updateBuilder);

        return (await GetDocumentByIdAsync(documentId))!;
    }

    public async Task DeleteDocumentAsync(string documentId, uint userId)
    {
        var document = await GetDocumentByIdAsync(documentId);
        if (document == null)
        {
            throw new KeyNotFoundException("Document not found");
        }

        if (document.UserId != userId)
        {
            throw new UnauthorizedAccessException("You don't have permission to delete this document");
        }

        // Soft delete
        var update = Builders<Document>.Update
            .Set(d => d.IsDeleted, true)
            .Set(d => d.UpdatedAt, DateTime.UtcNow);

        await _context.Documents.UpdateOneAsync(d => d.Id == documentId, update);

        // TODO: Delete from Supabase Storage

        _logger.LogInformation("Document deleted: {DocumentId} by user {UserId}", documentId, userId);
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
}
