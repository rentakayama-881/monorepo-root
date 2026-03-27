using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;

namespace FeatureService.Api.Controllers.Browser;

[ApiController]
[Route("api/v1/browser/sessions")]
[Authorize]
[Produces("application/json")]
public class BrowserSessionsController : ApiControllerBase
{
    private readonly IBrowserSessionService _sessionService;
    private readonly IBrowserBillingService _billingService;
    private readonly IBrowserProfileService _profileService;
    private readonly ILogger<BrowserSessionsController> _logger;

    public BrowserSessionsController(
        IBrowserSessionService sessionService,
        IBrowserBillingService billingService,
        IBrowserProfileService profileService,
        ILogger<BrowserSessionsController> logger)
    {
        _sessionService = sessionService;
        _billingService = billingService;
        _profileService = profileService;
        _logger = logger;
    }

    /// <summary>
    /// Ambil daftar sesi browser milik user
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<BrowserSessionListResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListSessions([FromQuery] bool activeOnly = false)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var result = await _sessionService.GetSessionsAsync(userId, activeOnly);
            return ApiOk(result, "Daftar sesi berhasil diambil");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error mengambil daftar sesi untuk user {UserId}", userId);
            return ApiInternalError("Terjadi kesalahan saat mengambil daftar sesi");
        }
    }

    /// <summary>
    /// Ambil detail sesi browser berdasarkan ID
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ApiResponse<BrowserSessionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSession(string id)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var result = await _sessionService.GetSessionAsync(id, userId);
            if (result == null)
                return ApiNotFound("SESSION_NOT_FOUND", "Sesi browser tidak ditemukan");

            return ApiOk(result, "Sesi berhasil diambil");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error mengambil sesi {SessionId} untuk user {UserId}", id, userId);
            return ApiInternalError("Terjadi kesalahan saat mengambil sesi");
        }
    }

    /// <summary>
    /// Mulai sesi browser baru
    /// </summary>
    [HttpPost("start")]
    [ProducesResponseType(typeof(ApiResponse<StartBrowserSessionResponse>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> StartSession([FromBody] StartBrowserSessionRequest request)
    {
        if (!ModelState.IsValid)
            return ApiBadRequest("VALIDATION_ERROR", "Data tidak valid");

        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            // Cek apakah user bisa memulai sesi baru
            var canStart = await _billingService.CanStartSessionAsync(userId);
            if (!canStart)
                return ApiBadRequest("CANNOT_START_SESSION",
                    "Tidak dapat memulai sesi baru. Pastikan saldo mencukupi dan jumlah sesi aktif belum mencapai batas maksimal.");

            // Cek profil ada
            var profile = await _profileService.GetProfileByIdAsync(request.ProfileId, userId);
            if (profile == null)
                return ApiNotFound("PROFILE_NOT_FOUND", "Profil browser tidak ditemukan");

            // Buat sesi — VNC URL akan di-assign oleh browser-service nanti
            var vncWsUrl = ""; // Placeholder, akan diisi oleh browser-service
            var result = await _sessionService.CreateSessionAsync(userId, request, vncWsUrl);

            // Update last session pada profil
            await _profileService.UpdateLastSessionAsync(request.ProfileId);

            return ApiCreated(result, "Sesi browser berhasil dimulai");
        }
        catch (ArgumentException ex)
        {
            return ApiBadRequest("VALIDATION_ERROR", ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return ApiBadRequest("SESSION_ERROR", ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error memulai sesi untuk user {UserId}", userId);
            return ApiInternalError("Terjadi kesalahan saat memulai sesi browser");
        }
    }

    /// <summary>
    /// Hentikan sesi browser
    /// </summary>
    [HttpPost("{id}/stop")]
    [ProducesResponseType(typeof(ApiResponse<StopBrowserSessionResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> StopSession(string id)
    {
        var userId = GetUserId();
        if (userId == 0)
            return ApiUnauthorized("UNAUTHORIZED", "User tidak terautentikasi");

        try
        {
            var result = await _sessionService.StopSessionAsync(id, userId, "user");
            return ApiOk(result, "Sesi browser berhasil dihentikan");
        }
        catch (InvalidOperationException ex)
        {
            return ApiNotFound("SESSION_NOT_FOUND", ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error menghentikan sesi {SessionId} untuk user {UserId}", id, userId);
            return ApiInternalError("Terjadi kesalahan saat menghentikan sesi");
        }
    }

    /// <summary>
    /// Ambil informasi pricing Smart Browser (publik)
    /// </summary>
    [HttpGet("pricing")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<BrowserPricingDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPricing()
    {
        try
        {
            var result = await _billingService.GetPricingAsync();
            return ApiOk(result, "Informasi pricing berhasil diambil");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error mengambil pricing");
            return ApiInternalError("Terjadi kesalahan saat mengambil informasi pricing");
        }
    }

    /// <summary>
    /// Internal billing tick — dipanggil oleh browser-service menggunakan X-Service-Token
    /// </summary>
    [HttpPost("billing/tick")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<BrowserBillingTickResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> BillingTick([FromBody] BrowserBillingTickRequest request)
    {
        // Validasi service token (bukan JWT)
        var serviceToken = Request.Headers["X-Service-Token"].FirstOrDefault();
        var configServiceToken = Environment.GetEnvironmentVariable("SERVICE_TOKEN") ?? "";

        if (string.IsNullOrEmpty(configServiceToken))
        {
            _logger.LogWarning("SERVICE_TOKEN tidak dikonfigurasi");
            return ApiUnauthorized("SERVICE_TOKEN_MISSING", "Service token tidak dikonfigurasi");
        }

        var hasValidToken = !string.IsNullOrEmpty(serviceToken)
            && CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(serviceToken!),
                Encoding.UTF8.GetBytes(configServiceToken));

        if (!hasValidToken)
        {
            _logger.LogWarning("Billing tick ditolak: service token tidak valid");
            return ApiUnauthorized("INVALID_SERVICE_TOKEN", "Service token tidak valid");
        }

        if (!ModelState.IsValid)
            return ApiBadRequest("VALIDATION_ERROR", "Data billing tick tidak valid");

        try
        {
            var result = await _billingService.ProcessBillingTickAsync(request);
            return ApiOk(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error memproses billing tick untuk sesi {SessionId}", request.SessionId);
            return ApiInternalError("Terjadi kesalahan saat memproses billing");
        }
    }
}
