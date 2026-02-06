using System.ComponentModel.DataAnnotations;

namespace FeatureService.Api.DTOs;

public class CreateDepositRequest
{
    [Required(ErrorMessage = "Jumlah deposit wajib diisi")]
    [Range(10000, long.MaxValue, ErrorMessage = "Minimum deposit Rp 10.000")]
    public long Amount { get; set; }

    [Required(ErrorMessage = "Metode pembayaran wajib diisi")]
    public string Method { get; set; } = "QRIS";

    [Required(ErrorMessage = "ID transaksi wajib diisi")]
    [StringLength(64, MinimumLength = 6, ErrorMessage = "ID transaksi tidak valid")]
    public string ExternalTransactionId { get; set; } = string.Empty;
}

public record DepositRequestResponse(
    string Id,
    long Amount,
    string Method,
    string ExternalTransactionId,
    string Status,
    DateTime CreatedAt
);

public record DepositHistoryResponse(
    List<DepositRequestResponse> Deposits,
    int Total
);

public class ApproveDepositRequest
{
    [Range(10000, long.MaxValue, ErrorMessage = "Jumlah tidak valid")]
    public long? AmountOverride { get; set; }
}

public class RejectDepositRequest
{
    [Required(ErrorMessage = "Alasan penolakan wajib diisi")]
    [StringLength(200, MinimumLength = 3, ErrorMessage = "Alasan penolakan harus 3-200 karakter")]
    public string Reason { get; set; } = string.Empty;
}

public record AdminDepositResponse(
    string Id,
    uint UserId,
    string Username,
    long Amount,
    string Method,
    string ExternalTransactionId,
    string Status,
    DateTime CreatedAt
);
