using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;

namespace FeatureService.Api.Controllers.Browser;

[ApiController]
[Route("api/v1/browser/profiles")]
[Authorize]
[Produces("application/json")]
public class BrowserProfilesController : ApiControllerBase
{
    private readonly IBrowserProfileService _profileService;
    private readonly ILogger<BrowserProfilesController> _logger;

    public BrowserProfilesController(
        IBrowserProfileService profileService,
        ILogger<BrowserProfilesController> logger)
    {
        _profileService = profileService;
        _logger = logger;
    }

    /// <summary>
    /// Ambil daftar profil browser milik user
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<BrowserProfileListResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProfiles()
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var result = await _profileService.GetProfilesAsync(userId);
            return ApiOk(result, "Daftar profil berhasil diambil");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error mengambil daftar profil untuk user {UserId}", userId);
            return ApiInternalError("Terjadi kesalahan saat mengambil daftar profil");
        }
    }

    /// <summary>
    /// Ambil detail profil browser berdasarkan ID
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<BrowserProfileDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProfile(string id)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var result = await _profileService.GetProfileByIdAsync(id, userId);
            if (result == null)
                return ApiNotFound("PROFILE_NOT_FOUND", "Profil browser tidak ditemukan");

            return ApiOk(result, "Profil berhasil diambil");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error mengambil profil {ProfileId} untuk user {UserId}", id, userId);
            return ApiInternalError("Terjadi kesalahan saat mengambil profil");
        }
    }

    /// <summary>
    /// Buat profil browser baru
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<BrowserProfileDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateProfile([FromBody] CreateBrowserProfileRequest request)
    {
        if (!ModelState.IsValid)
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");

        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var result = await _profileService.CreateProfileAsync(userId, request);
            return ApiCreated(result, "Profil browser berhasil dibuat");
        }
        catch (ArgumentException ex)
        {
            return ApiBadRequest("VALIDATION_ERROR", ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error membuat profil untuk user {UserId}", userId);
            return ApiInternalError("Terjadi kesalahan saat membuat profil");
        }
    }

    /// <summary>
    /// Update profil browser
    /// </summary>
    [HttpPut("{id}")]
    [ProducesResponseType(typeof(ApiResponse<BrowserProfileDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateProfile(string id, [FromBody] UpdateBrowserProfileRequest request)
    {
        if (!ModelState.IsValid)
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");

        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var result = await _profileService.UpdateProfileAsync(id, userId, request);
            if (result == null)
                return ApiNotFound("PROFILE_NOT_FOUND", "Profil browser tidak ditemukan");

            return ApiOk(result, "Profil berhasil diperbarui");
        }
        catch (ArgumentException ex)
        {
            return ApiBadRequest("VALIDATION_ERROR", ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error memperbarui profil {ProfileId} untuk user {UserId}", id, userId);
            return ApiInternalError("Terjadi kesalahan saat memperbarui profil");
        }
    }

    /// <summary>
    /// Hapus profil browser
    /// </summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteProfile(string id)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var deleted = await _profileService.DeleteProfileAsync(id, userId);
            if (!deleted)
                return ApiNotFound("PROFILE_NOT_FOUND", "Profil browser tidak ditemukan");

            return ApiOk(new { deleted = true }, "Profil berhasil dihapus");
        }
        catch (InvalidOperationException ex)
        {
            return ApiBadRequest("PROFILE_IN_USE", ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error menghapus profil {ProfileId} untuk user {UserId}", id, userId);
            return ApiInternalError("Terjadi kesalahan saat menghapus profil");
        }
    }
}
