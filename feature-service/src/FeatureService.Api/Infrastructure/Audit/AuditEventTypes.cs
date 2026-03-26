namespace FeatureService.Api.Infrastructure.Audit;

/// <summary>
/// Konstanta untuk TransactionType string pada audit trail.
/// Digunakan sebagai nilai TransactionType di AuditEventRequest.
/// </summary>
public static class AuditTransactionTypes
{
    public const string Transfer = "TRANSFER";
    public const string Withdrawal = "WITHDRAWAL";
    public const string Deposit = "DEPOSIT";
    public const string PqcKey = "PQC_KEY";
    public const string Security = "SECURITY";
    public const string AccountLifecycle = "ACCOUNT_LIFECYCLE";
    public const string DataExport = "DATA_EXPORT";
    public const string Wallet = "WALLET";
}

/// <summary>
/// Konstanta untuk action string yang digunakan di Details["action"] pada audit trail.
/// Menstandarkan string aksi agar konsisten di seluruh codebase.
/// </summary>
public static class AuditActions
{
    // Transfer actions
    public const string DuplicateRequestBlocked = "DUPLICATE_REQUEST_BLOCKED";
    public const string ReleaseInitiated = "RELEASE_INITIATED";
    public const string Released = "RELEASED";
    public const string ReleaseFailed = "RELEASE_FAILED";
    public const string CancelInitiated = "CANCEL_INITIATED";
    public const string Cancelled = "CANCELLED";
    public const string CancelFailed = "CANCEL_FAILED";
    public const string RejectInitiated = "REJECT_INITIATED";
    public const string Rejected = "REJECTED";
    public const string RejectFailed = "REJECT_FAILED";

    // Data deletion actions
    public const string DeletionValidated = "DELETION_VALIDATED";
    public const string DeletionCompleted = "DELETION_COMPLETED";
    public const string DeletionFailed = "DELETION_FAILED";

    // Change tracking
    public const string FieldChanged = "FIELD_CHANGED";
}
