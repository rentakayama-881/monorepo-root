namespace FeatureService.Api.Models.Entities;

public class MarketPurchaseReservation
{
    public string Id { get; set; } = string.Empty;

    public string OrderId { get; set; } = string.Empty;

    public uint UserId { get; set; }

    public long AmountIdr { get; set; }

    public string Status { get; set; } = ReservationStatus.Reserved;

    public string? ReserveTransactionId { get; set; }

    public string? ReleaseTransactionId { get; set; }

    public string? Reason { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateTime? CapturedAt { get; set; }

    public DateTime? ReleasedAt { get; set; }
}

public static class ReservationStatus
{
    public const string Reserved = "reserved";
    public const string Releasing = "releasing";
    public const string Captured = "captured";
    public const string Released = "released";
}
