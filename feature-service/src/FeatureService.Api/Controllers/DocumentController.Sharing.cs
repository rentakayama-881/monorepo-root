using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.Services;
using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.Controllers;

public partial class DocumentController
{
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
    /// View a document file inline when supported by browser
    /// </summary>
    [HttpGet("{id}/view")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ViewDocument(string id)
    {
        var currentUserId = GetCurrentUserId();
        var isAdmin = IsCurrentUserAdmin();
        var access = await _documentService.GetDocumentAccessAsync(id);

        if (access == null)
        {
            return NotFound(new { error = "Document not found" });
        }

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

        var contentType = DocumentFileType.ResolveMimeType($".{access.FileType}");
        var safeFileName = string.IsNullOrWhiteSpace(access.FileName)
            ? $"document-{id}"
            : access.FileName.Replace("\"", string.Empty);
        Response.Headers.ContentDisposition = $"inline; filename=\"{safeFileName}\"";
        return File(fileData, contentType);
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

        var contentType = DocumentFileType.ResolveMimeType($".{access.FileType}");
        return File(fileData, contentType, access.FileName);
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
}
