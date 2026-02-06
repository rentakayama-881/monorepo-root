using System.ComponentModel.DataAnnotations;

namespace FeatureService.Api.DTOs;

// Wallet DTOs
public record GetWalletResponse(
    uint UserId,
    long Balance,
    bool PinSet,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record PinStatusResponse(
    bool PinSet,
    bool IsLocked,
    DateTime? LockedUntil,
    int FailedAttempts,
    int MaxAttempts
);

public class SetPinRequest
{
    [Required(ErrorMessage = "PIN wajib diisi")]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "PIN harus 6 digit")]
    [RegularExpression(@"^\d{6}$", ErrorMessage = "PIN harus berisi angka saja")]
    public string Pin { get; set; } = string.Empty;

    [Required(ErrorMessage = "Konfirmasi PIN wajib diisi")]
    [Compare(nameof(Pin), ErrorMessage = "Konfirmasi PIN tidak cocok")]
    public string ConfirmPin { get; set; } = string.Empty;
}

public class ChangePinRequest
{
    [Required(ErrorMessage = "PIN lama wajib diisi")]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "PIN harus 6 digit")]
    public string CurrentPin { get; set; } = string.Empty;

    [Required(ErrorMessage = "PIN baru wajib diisi")]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "PIN harus 6 digit")]
    [RegularExpression(@"^\d{6}$", ErrorMessage = "PIN harus berisi angka saja")]
    public string NewPin { get; set; } = string.Empty;

    [Required(ErrorMessage = "Konfirmasi PIN baru wajib diisi")]
    [Compare(nameof(NewPin), ErrorMessage = "Konfirmasi PIN tidak cocok")]
    public string ConfirmPin { get; set; } = string.Empty;
}

public class VerifyPinRequest
{
    [Required(ErrorMessage = "PIN wajib diisi")]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "PIN harus 6 digit")]
    public string Pin { get; set; } = string.Empty;
}

public record VerifyPinResponse(
    bool Valid,
    string Message,
    int? RemainingAttempts
);

// Transaction DTOs
public record TransactionDto(
    string Id,
    string Type,
    long Amount,
    long BalanceBefore,
    long BalanceAfter,
    string Description,
    string? ReferenceId,
    string? ReferenceType,
    DateTime CreatedAt
);

public record GetTransactionsResponse(
    List<TransactionDto> Transactions,
    int Total,
    int Page,
    int PageSize
);

// Transfer DTOs
public record CreateTransferRequest(
    string ReceiverUsername,
    long Amount,
    string? Message,
    string Pin,
    int HoldHours = 168 // Default 7 days hold period
);

public record CreateTransferResponse(
    string TransferId,
    string Code,
    long Amount,
    string ReceiverUsername,
    DateTime HoldUntil
);

public record TransferDto(
    string Id,
    string Code,
    uint SenderId,
    string SenderUsername,
    string? SenderAvatarUrl,
    uint ReceiverId,
    string ReceiverUsername,
    string? ReceiverAvatarUrl,
    long Amount,
    string? Message,
    string Status,
    DateTime? HoldUntil,
    DateTime? ReleasedAt,
    DateTime? CancelledAt,
    string? CancelReason,
    DateTime CreatedAt
);

public record GetTransfersResponse(
    List<TransferDto> Transfers,
    int Total
);

public record ReleaseTransferRequest(
    string Pin
);

public record CancelTransferRequest(
    string Pin,
    string Reason
);

public record SearchUserRequest(
    string Username
);

public record SearchUserResponse(
    uint UserId,
    string Username,
    string? AvatarUrl,
    bool Exists
);
