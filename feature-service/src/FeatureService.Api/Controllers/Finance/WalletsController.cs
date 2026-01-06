using System.Security.Claims;
using FeatureService.Api.DTOs;
using FeatureService.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FeatureService.Api.Controllers.Finance;

[ApiController]
[Route("api/v1/wallets")]
[Authorize]
public class WalletsController : ControllerBase
{
    private readonly IWalletService _walletService;
    private readonly ILogger<WalletsController> _logger;

    public WalletsController(IWalletService walletService, ILogger<WalletsController> logger)
    {
        _walletService = walletService;
        _logger = logger;
    }

    private uint GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                       ?? User.FindFirst("user_id")?.Value
                       ?? User.FindFirst("sub")?.Value;
        
        if (string.IsNullOrEmpty(userIdClaim) || !uint.TryParse(userIdClaim, out uint userId))
        {
            throw new UnauthorizedAccessException("User ID tidak ditemukan");
        }
        
        return userId;
    }

    /// <summary>
    /// Get current user's wallet information
    /// </summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(GetWalletResponse), 200)]
    public async Task<IActionResult> GetMyWallet()
    {
        try
        {
            var userId = GetUserId();
            var wallet = await _walletService.GetOrCreateWalletAsync(userId);
            
            var response = new GetWalletResponse(
                wallet.UserId,
                wallet.Balance,
                wallet.PinSet,
                wallet.CreatedAt,
                wallet.UpdatedAt
            );
            
            return Ok(response);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting wallet");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    /// <summary>
    /// Get PIN status (set/not set, locked/not locked)
    /// </summary>
    [HttpGet("pin/status")]
    [ProducesResponseType(typeof(PinStatusResponse), 200)]
    public async Task<IActionResult> GetPinStatus()
    {
        try
        {
            var userId = GetUserId();
            var status = await _walletService.GetPinStatusAsync(userId);
            return Ok(status);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting PIN status");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    /// <summary>
    /// Set PIN for first time
    /// </summary>
    [HttpPost("pin/set")]
    [ProducesResponseType(200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> SetPin([FromBody] SetPinRequest request)
    {
        try
        {
            var userId = GetUserId();
            await _walletService.SetPinAsync(userId, request.Pin);
            
            return Ok(new { message = "PIN berhasil diset" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error setting PIN");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    /// <summary>
    /// Change existing PIN
    /// </summary>
    [HttpPost("pin/change")]
    [ProducesResponseType(200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(401)]
    public async Task<IActionResult> ChangePin([FromBody] ChangePinRequest request)
    {
        try
        {
            var userId = GetUserId();
            await _walletService.ChangePinAsync(userId, request.CurrentPin, request.NewPin);
            
            return Ok(new { message = "PIN berhasil diubah" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error changing PIN");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    /// <summary>
    /// Verify PIN (for transaction authorization)
    /// </summary>
    [HttpPost("pin/verify")]
    [ProducesResponseType(typeof(VerifyPinResponse), 200)]
    [ProducesResponseType(401)]
    public async Task<IActionResult> VerifyPin([FromBody] VerifyPinRequest request)
    {
        try
        {
            var userId = GetUserId();
            var result = await _walletService.VerifyPinAsync(userId, request.Pin);
            
            if (!result.Valid)
            {
                return Unauthorized(result);
            }
            
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { valid = false, message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying PIN");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    /// <summary>
    /// Get transaction history with pagination
    /// </summary>
    [HttpGet("transactions")]
    [ProducesResponseType(typeof(GetTransactionsResponse), 200)]
    public async Task<IActionResult> GetTransactions([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        try
        {
            var userId = GetUserId();
            
            // Clamp page size
            pageSize = Math.Clamp(pageSize, 1, 50);
            page = Math.Max(1, page);
            
            var transactions = await _walletService.GetTransactionsAsync(userId, page, pageSize);
            var totalCount = await _walletService.GetTransactionCountAsync(userId);
            
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
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting transactions");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }

    /// <summary>
    /// Recalculate balance from ledger (for audit)
    /// </summary>
    [HttpPost("audit/recalculate")]
    [ProducesResponseType(200)]
    public async Task<IActionResult> RecalculateBalance()
    {
        try
        {
            var userId = GetUserId();
            var balance = await _walletService.RecalculateBalanceFromLedgerAsync(userId);
            
            return Ok(new { 
                message = "Balance recalculated from ledger",
                balance = balance
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recalculating balance");
            return StatusCode(500, new { message = "Internal server error" });
        }
    }
}
