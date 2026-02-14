using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.Services;
using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;
using System.Security.Claims;

namespace FeatureService.Api.Controllers;

/// <summary>
/// Document storage endpoints for user profiles (whitepapers, articles, etc.)
/// </summary>
[ApiController]
[Route("api/v1/documents")]
[Authorize]
public class DocumentController : ControllerBase
{
    private readonly IDocumentService _documentService;
    private readonly ILogger<DocumentController> _logger;

    public DocumentController(IDocumentService documentService, ILogger<DocumentController> logger)
    {
        _documentService = documentService;
        _logger = logger;
    }

    /// <summary>
    /// Upload a document to user's profile storage
    /// </summary>
    [HttpPost]
    [RequestSizeLimit(11 * 1024 * 1024)] // 11MB to account for overhead
    [ProducesResponseType(typeof(DocumentUploadResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    public async Task<IActionResult> UploadDocument([FromForm] UploadDocumentFormRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == 0)
        {
            return Unauthorized(new { error = "User not authenticated" });
        }

        if (request.File == null || request.File.Length == 0)
        {
            return BadRequest(new { error = "No file provided" });
        }

        // Validate file size (10MB max)
        if (request.File.Length > DocumentFileType.MaxFileSizeBytes)
        {
            return StatusCode(413, new { error = $"File size exceeds maximum limit of {DocumentFileType.MaxFileSizeBytes / (1024 * 1024)}MB" });
        }

        // Validate file type
        var extension = Path.GetExtension(request.File.FileName).ToLowerInvariant();
        if (extension != ".pdf" && extension != ".docx")
        {
            return BadRequest(new { error = "Invalid file type. Only PDF and DOCX files are allowed" });
        }

        // Validate category
        if (!string.IsNullOrEmpty(request.Category) && !DocumentCategory.All.Contains(request.Category))
        {
            return BadRequest(new { error = "Invalid category. Must be one of: " + string.Join(", ", DocumentCategory.All) });
        }

        // Validate visibility
        if (!string.IsNullOrEmpty(request.Visibility) && !DocumentVisibility.All.Contains(request.Visibility))
        {
            return BadRequest(new { error = "Invalid visibility. Must be one of: " + string.Join(", ", DocumentVisibility.All) });
        }

        try
        {
            // Read file into memory
            using var memoryStream = new MemoryStream();
            await request.File.CopyToAsync(memoryStream);
            var fileData = memoryStream.ToArray();

            var uploadRequest = new UploadDocumentRequest(
                FileName: request.File.FileName,
                FileType: extension.TrimStart('.'),
                FileData: fileData,
                Title: request.Title,
                Description: request.Description,
                Category: request.Category ?? DocumentCategory.Other,
                Visibility: request.Visibility ?? DocumentVisibility.Private,
                Tags: request.Tags?.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
            );

            var documentId = await _documentService.UploadDocumentAsync(userId, uploadRequest);

            _logger.LogInformation("Document uploaded: {DocumentId} by user {UserId}", documentId, userId);

            return CreatedAtAction(nameof(GetDocument), new { id = documentId },
                new DocumentUploadResponse(documentId, "Document uploaded successfully"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to upload document for user {UserId}", userId);
            return StatusCode(500, new { error = "Failed to upload document" });
        }
    }

    /// <summary>
    /// Get user's documents
    /// </summary>
    [HttpGet("my-documents")]
    [ProducesResponseType(typeof(PaginatedDocumentsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyDocuments(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? category = null)
    {
        var userId = GetCurrentUserId();
        if (userId == 0)
        {
            return Unauthorized(new { error = "User not authenticated" });
        }

        pageSize = Math.Min(pageSize, 50);
        var documents = await _documentService.GetUserDocumentsAsync(userId, page, pageSize, category);
        return Ok(documents);
    }

    /// <summary>
    /// Get a specific document
    /// </summary>
    [HttpGet("{id}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(DocumentDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetDocument(string id)
    {
        var currentUserId = GetCurrentUserId();
        var isAdmin = IsCurrentUserAdmin();
        var access = await _documentService.GetDocumentAccessAsync(id);

        if (access == null)
        {
            return NotFound(new { error = "Document not found" });
        }

        // Check access permissions
        if (access.Visibility == DocumentVisibility.Private
            && access.UserId != currentUserId
            && !isAdmin
            && !(access.SharedWithUserIds?.Contains(currentUserId) ?? false))
        {
            return Forbid();
        }

        var document = await _documentService.GetDocumentByIdAsync(id);
        if (document == null)
        {
            return NotFound(new { error = "Document not found" });
        }

        return Ok(document);
    }

    /// <summary>
    /// Download a document file
    /// </summary>
    [HttpGet("{id}/download")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DownloadDocument(string id)
    {
        var currentUserId = GetCurrentUserId();
        var isAdmin = IsCurrentUserAdmin();
        var access = await _documentService.GetDocumentAccessAsync(id);

        if (access == null)
        {
            return NotFound(new { error = "Document not found" });
        }

        // Check access permissions
        if (access.Visibility == DocumentVisibility.Private
            && access.UserId != currentUserId
            && !isAdmin
            && !(access.SharedWithUserIds?.Contains(currentUserId) ?? false))
        {
            return Forbid();
        }

        var fileData = await _documentService.GetDocumentFileAsync(id);
        if (fileData == null)
        {
            return NotFound(new { error = "Document file not found" });
        }

        // Increment download count
        await _documentService.IncrementDownloadCountAsync(id);

        var contentType = access.FileType == "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        return File(fileData, contentType, access.FileName);
    }

    /// <summary>
    /// Update document metadata
    /// </summary>
    [HttpPatch("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateDocument(string id, [FromBody] UpdateDocumentRequest request)
    {
        var userId = GetCurrentUserId();
        var document = await _documentService.GetDocumentByIdAsync(id);

        if (document == null)
        {
            return NotFound(new { error = "Document not found" });
        }

        if (document.UserId != userId)
        {
            return Forbid();
        }

        // Validate category if provided
        if (!string.IsNullOrEmpty(request.Category) && !DocumentCategory.All.Contains(request.Category))
        {
            return BadRequest(new { error = "Invalid category" });
        }

        // Validate visibility if provided
        if (!string.IsNullOrEmpty(request.Visibility) && !DocumentVisibility.All.Contains(request.Visibility))
        {
            return BadRequest(new { error = "Invalid visibility" });
        }

        await _documentService.UpdateDocumentAsync(id, request);
        return Ok(new { message = "Document updated successfully" });
    }

    /// <summary>
    /// Update private document sharing list (owner/admin)
    /// </summary>
    [HttpPatch("{id}/sharing")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdateDocumentSharing(string id, [FromBody] UpdateDocumentSharingRequest request)
    {
        var userId = GetCurrentUserId();
        if (userId == 0)
        {
            return Unauthorized(new { error = "User not authenticated" });
        }

        var access = await _documentService.GetDocumentAccessAsync(id);
        if (access == null)
        {
            return NotFound(new { error = "Document not found" });
        }

        if (access.UserId != userId && !IsCurrentUserAdmin())
        {
            return Forbid();
        }

        await _documentService.UpdateDocumentSharingAsync(id, request.SharedWithUserIds);
        return Ok(new { message = "Document sharing updated successfully" });
    }

    /// <summary>
    /// Delete a document
    /// </summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteDocument(string id)
    {
        var userId = GetCurrentUserId();
        var document = await _documentService.GetDocumentByIdAsync(id);

        if (document == null)
        {
            return NotFound(new { error = "Document not found" });
        }

        if (document.UserId != userId && !IsCurrentUserAdmin())
        {
            return Forbid();
        }

        await _documentService.DeleteDocumentAsync(id);
        _logger.LogInformation("Document deleted: {DocumentId} by user {UserId}", id, userId);

        return Ok(new { message = "Document deleted successfully" });
    }

    /// <summary>
    /// Get user's storage quota
    /// </summary>
    [HttpGet("quota")]
    [ProducesResponseType(typeof(StorageQuotaDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStorageQuota()
    {
        var userId = GetCurrentUserId();
        if (userId == 0)
        {
            return Unauthorized(new { error = "User not authenticated" });
        }

        var quota = await _documentService.GetUserQuotaAsync(userId);
        return Ok(quota);
    }

    /// <summary>
    /// Get public documents from a specific user's profile
    /// </summary>
    [HttpGet("user/{userId}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PaginatedDocumentsResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUserPublicDocuments(
        uint userId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? category = null)
    {
        pageSize = Math.Min(pageSize, 50);
        var documents = await _documentService.GetPublicDocumentsAsync(userId, page, pageSize, category);
        return Ok(documents);
    }

    /// <summary>
    /// Get available document categories
    /// </summary>
    [HttpGet("categories")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(DocumentCategoriesResponse), StatusCodes.Status200OK)]
    public IActionResult GetCategories()
    {
        return Ok(new DocumentCategoriesResponse(DocumentCategory.All.ToList()));
    }

    private uint GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("user_id")?.Value;

        return uint.TryParse(userIdClaim, out var id) ? id : 0;
    }

    private bool IsCurrentUserAdmin()
    {
        var isAdminToken = string.Equals(
            User.FindFirst("type")?.Value,
            "admin",
            StringComparison.OrdinalIgnoreCase);
        if (!isAdminToken) return false;

        return User.IsInRole("admin")
            || User.HasClaim("role", "admin")
            || User.HasClaim(ClaimTypes.Role, "admin");
    }
}

// Request/Response DTOs
public class UploadDocumentFormRequest
{
    public IFormFile? File { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Category { get; set; }
    public string? Visibility { get; set; }
    public string? Tags { get; set; } // Comma-separated
}

public record DocumentUploadResponse(string DocumentId, string Message);
public record DocumentCategoriesResponse(List<string> Categories);
