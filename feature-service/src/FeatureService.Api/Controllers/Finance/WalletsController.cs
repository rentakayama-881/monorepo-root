using FeatureService.Api.DTOs;
using FeatureService.Api.Services;
using FeatureService.Api.Infrastructure.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FeatureService.Api.Controllers.Finance;

[ApiController]
[Route("api/v1/wallets")]
[Authorize]
public class WalletsController : ApiControllerBase
{
    private readonly IWalletService _walletService;
    private readonly IUserContextAccessor _userContextAccessor;
    private readonly ILogger<WalletsController> _logger;

    public WalletsController(
        IWalletService walletService, 
        IUserContextAccessor userContextAccessor,
        ILogger<WalletsController> logger)
    {
        _walletService = walletService;
        _userContextAccessor = userContextAccessor;
        _logger = logger;
    }

    /// <summary>
    /// Get current user's wallet information
    /// </summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(GetWalletResponse), 200)]
    [ProducesResponseType(typeof(ApiErrorResponse), 401)]
    public async Task<IActionResult> GetMyWallet()
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("User tidak terautentikasi");
        }

        try
        {
            var wallet = await _walletService.GetOrCreateWalletAsync(user.UserId);
            
            var response = new GetWalletResponse(
                wallet.UserId,
                wallet.Balance,
                wallet.PinSet,
                wallet.CreatedAt,
                wallet.UpdatedAt
            );
            
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting wallet for user {UserId}", user.UserId);
            return ApiInternalError("Gagal memuat data wallet");
        }
    }

    /// <summary>
    /// Get PIN status (set/not set, locked/not locked)
    /// </summary>
    [HttpGet("pin/status")]
    [ProducesResponseType(typeof(PinStatusResponse), 200)]
    [ProducesResponseType(typeof(ApiErrorResponse), 401)]
    public async Task<IActionResult> GetPinStatus()
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("User tidak terautentikasi");
        }

        try
        {
            var status = await _walletService.GetPinStatusAsync(user.UserId);
            return Ok(status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting PIN status for user {UserId}", user.UserId);
            return ApiInternalError("Gagal memuat status PIN");
        }
    }

    /// <summary>
    /// Set PIN for first time - REQUIRES 2FA ENABLED
    /// </summary>
    /// <remarks>
    /// ⚠️ SECURITY WARNING ⚠️
    /// - Two-Factor Authentication (2FA) MUST be enabled before setting PIN
    /// - PIN CANNOT be reset - there is NO recovery option
    /// - If you forget your PIN, you will permanently lose access to financial features
    /// - Write your PIN on paper and store it in a safe place
    /// - Do not share your PIN with anyone, including support staff
    /// </remarks>
    [HttpPost("pin/set")]
    [ProducesResponseType(200)]
    [ProducesResponseType(typeof(ApiErrorResponse), 400)]
    [ProducesResponseType(typeof(ApiErrorResponse), 401)]
    [ProducesResponseType(typeof(ApiErrorResponse), 403)]
    public async Task<IActionResult> SetPin([FromBody] SetPinRequest request)
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("User tidak terautentikasi");
        }

        // CRITICAL: Require 2FA before setting PIN
        var twoFactorCheck = RequiresTwoFactorAuth();
        if (twoFactorCheck != null) return twoFactorCheck;

        try
        {
            await _walletService.SetPinAsync(user.UserId, request.Pin);
            return Ok(new { 
                message = "PIN successfully set",
                warning = "IMPORTANT: Your PIN cannot be reset or recovered. " +
                          "If you forget your PIN, you will permanently lose access to financial features. " +
                          "Please write it down and store it securely."
            });
        }
        catch (InvalidOperationException ex)
        {
            return ApiBadRequest(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return ApiBadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error setting PIN for user {UserId}", user.UserId);
            return ApiInternalError("Failed to set PIN");
        }
    }

    /// <summary>
    /// Change existing PIN
    /// </summary>
    [HttpPost("pin/change")]
    [ProducesResponseType(200)]
    [ProducesResponseType(typeof(ApiErrorResponse), 400)]
    [ProducesResponseType(typeof(ApiErrorResponse), 401)]
    public async Task<IActionResult> ChangePin([FromBody] ChangePinRequest request)
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("User tidak terautentikasi");
        }

        try
        {
            await _walletService.ChangePinAsync(user.UserId, request.CurrentPin, request.NewPin);
            return Ok(new { message = "PIN berhasil diubah" });
        }
        catch (InvalidOperationException ex)
        {
            return ApiBadRequest(ex.Message);
        }
        catch (ArgumentException ex)
        {
            return ApiBadRequest(ex.Message);
        }
        catch (UnauthorizedAccessException ex)
        {
            return ApiError(401, ApiErrorCodes.InvalidPin, ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error changing PIN for user {UserId}", user.UserId);
            return ApiInternalError("Gagal mengubah PIN");
        }
    }

    /// <summary>
    /// Verify PIN (for transaction authorization)
    /// </summary>
    [HttpPost("pin/verify")]
    [ProducesResponseType(typeof(VerifyPinResponse), 200)]
    [ProducesResponseType(typeof(ApiErrorResponse), 401)]
    public async Task<IActionResult> VerifyPin([FromBody] VerifyPinRequest request)
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("User tidak terautentikasi");
        }

        try
        {
            var result = await _walletService.VerifyPinAsync(user.UserId, request.Pin);
            
            if (!result.Valid)
            {
                return ApiError(401, ApiErrorCodes.InvalidPin, result.Message);
            }
            
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying PIN for user {UserId}", user.UserId);
            return ApiInternalError("Gagal memverifikasi PIN");
        }
    }

    /// <summary>
    /// Get transaction history with pagination
    /// </summary>
    [HttpGet("transactions")]
    [ProducesResponseType(typeof(GetTransactionsResponse), 200)]
    [ProducesResponseType(typeof(ApiErrorResponse), 401)]
    public async Task<IActionResult> GetTransactions([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("User tidak terautentikasi");
        }

        try
        {
            // Clamp page size
            pageSize = Math.Clamp(pageSize, 1, 50);
            page = Math.Max(1, page);
            
            var transactions = await _walletService.GetTransactionsAsync(user.UserId, page, pageSize);
            var totalCount = await _walletService.GetTransactionCountAsync(user.UserId);
            
            var response = new GetTransactionsResponse(
                transactions.Select(t => new TransactionDto(
                    t.Id,
                    t.Type.ToString(),
                    t.Amount,
                    t.BalanceBefore,
                    t.BalanceAfter,
                    t.Description,
                    t.ReferenceId,
                    t.ReferenceType,
                    t.CreatedAt
                )).ToList(),
                totalCount,
                page,
                pageSize
            );
            
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting transactions for user {UserId}", user.UserId);
            return ApiInternalError("Gagal memuat riwayat transaksi");
        }
    }

    /// <summary>
    /// Recalculate balance from ledger (for audit)
    /// </summary>
    [HttpPost("audit/recalculate")]
    [ProducesResponseType(200)]
    [ProducesResponseType(typeof(ApiErrorResponse), 401)]
    public async Task<IActionResult> RecalculateBalance()
    {
        var user = _userContextAccessor.GetCurrentUser();
        if (user == null)
        {
            return ApiUnauthorized("User tidak terautentikasi");
        }

        try
        {
            var balance = await _walletService.RecalculateBalanceFromLedgerAsync(user.UserId);
            
            return Ok(new { 
                message = "Balance recalculated from ledger",
                balance = balance
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recalculating balance for user {UserId}", user.UserId);
            return ApiInternalError("Gagal menghitung ulang saldo");
        }
    }

}
