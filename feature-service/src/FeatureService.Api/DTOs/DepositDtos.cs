using System.ComponentModel.DataAnnotations;

namespace FeatureService.Api.DTOs;

// =====================
// DEPOSIT REQUEST DTOs
// =====================

public class CreateDepositRequest
{
    [Required(ErrorMessage = "Jumlah deposit wajib diisi")]
    [Range(10000, long.MaxValue, ErrorMessage = "Minimum deposit Rp 10.000")]
    public long Amount { get; set; }

    /// <summary>
    /// Cryptocurrency to pay with (e.g., "USDT", "TON"). Optional, uses default if not specified.
    /// </summary>
    public string? PayCurrency { get; set; }

    /// <summary>
    /// Blockchain network (e.g., "TRC20"). Optional, uses OxaPay default.
    /// </summary>
    public string? Network { get; set; }
}

// =====================
// DEPOSIT RESPONSE DTOs
// =====================

public record CreateDepositResponse(
    string DepositId,
    string TrackId,
    string Address,
    string? QrCode,
    string PayAmount,
    string PayCurrency,
    string Network,
    string? Rate,
    long ExpiredAt,
    long PlatformFee,
    long Amount
);

public record DepositRequestResponse(
    string Id,
    long Amount,
    long PlatformFee,
    string PayCurrency,
    string PayAmount,
    string Status,
    DateTime CreatedAt,
    long ExpiredAt
);

public record DepositHistoryResponse(
    List<DepositRequestResponse> Deposits,
    int Total
);

public record DepositStatusResponse(
    string Status,
    string PayAmount,
    string PayCurrency,
    string Address,
    string? QrCode,
    long ExpiredAt,
    bool WalletCredited
);

