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
    
    [Required]
    [StringLength(20, MinimumLength = 3)]
    string BankCode,
    
    [Required]
    [StringLength(30, MinimumLength = 5)]
    string AccountNumber,
    
    [Required]
    [StringLength(100, MinimumLength = 3)]
    string AccountName,
    
    [Required]
    [StringLength(6, MinimumLength = 6)]
    string Pin
);

public record CancelWithdrawalRequest(
    [Required]
    string Pin
);

// For admin
public record ProcessWithdrawalRequest(
    bool Approve,
    string? RejectionReason
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
    string BankCode,
    string BankName,
    string MaskedAccountNumber,  // Only show last 4 digits
    string AccountName,
    string Status,
    string Reference,
    string? RejectionReason,
    DateTime CreatedAt,
    DateTime? ProcessedAt
);

public record WithdrawalSummaryDto(
    string Id,
    long Amount,
    long NetAmount,
    string BankName,
    string Status,
    string Reference,
    DateTime CreatedAt
);

public record WithdrawalStatsDto(
    int TotalWithdrawals,
    long TotalAmount,
    int PendingCount,
    int CompletedCount,
    int RejectedCount
);

// Bank info
public record BankInfoDto(
    string Code,
    string Name,
    string ShortName
);
