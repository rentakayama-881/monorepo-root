using System.ComponentModel.DataAnnotations;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.DTOs;

// =====================
// WITHDRAWAL REQUEST DTOs
// =====================

public record CreateWithdrawalRequest(
    [Required]
    [Range(10000, 100000000, ErrorMessage = "Minimal penarikan Rp10.000, maksimal Rp100.000.000")]
    long Amount,
    
    [Required(ErrorMessage = "Alamat crypto wajib diisi")]
    [StringLength(256, MinimumLength = 10, ErrorMessage = "Alamat crypto tidak valid")]
    string CryptoAddress,
    
    [Required(ErrorMessage = "Mata uang crypto wajib diisi")]
    [StringLength(20, MinimumLength = 2)]
    string CryptoCurrency,
    
    string? Network,
    
    string? Memo,
    
    [Required]
    [StringLength(6, MinimumLength = 6)]
    string Pin
);

public record CancelWithdrawalRequest(
    [Required]
    string Pin
);

// =====================
// WITHDRAWAL RESPONSE DTOs
// =====================

public record CreateWithdrawalResponse(
    bool Success,
    string? WithdrawalId,
    string? Reference,
    string? Error
);

public record WithdrawalDto(
    string Id,
    uint UserId,
    string Username,
    long Amount,
    long Fee,
    long NetAmount,
    string CryptoAddress,
    string CryptoCurrency,
    string? CryptoNetwork,
    string? CryptoAmount,
    string? TrackId,
    string? TxHash,
    string Status,
    string Reference,
    string? FailureReason,
    DateTime CreatedAt,
    DateTime? CompletedAt
);

public record WithdrawalSummaryDto(
    string Id,
    long Amount,
    long NetAmount,
    string CryptoCurrency,
    string Status,
    string Reference,
    DateTime CreatedAt
);

// Supported crypto currencies info
public record CryptoCurrencyInfoDto(
    string Symbol,
    string Name,
    string[] SupportedNetworks
);
