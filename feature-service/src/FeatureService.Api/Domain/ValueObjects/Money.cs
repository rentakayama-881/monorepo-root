using System.Globalization;

namespace FeatureService.Api.Domain.ValueObjects;

/// <summary>
/// Immutable Value Object untuk representasi uang IDR dengan presisi tinggi.
/// Menggunakan Banker's Rounding (MidpointRounding.ToEven) untuk akurasi finansial.
/// </summary>
public readonly struct Money : IEquatable<Money>, IComparable<Money>
{
    /// <summary>
    /// Internal precision untuk kalkulasi (4 decimal places)
    /// </summary>
    private const int InternalDecimalPlaces = 4;
    
    /// <summary>
    /// Display precision untuk IDR (0 decimal places, karena IDR tidak punya sen)
    /// </summary>
    private const int DisplayDecimalPlaces = 0;
    
    /// <summary>
    /// Maximum amount yang diizinkan (999 triliun rupiah)
    /// </summary>
    public const decimal MaxAmount = 999_999_999_999_999m;
    
    /// <summary>
    /// Minimum amount untuk transfer (Rp 1.000)
    /// </summary>
    public const decimal MinTransferAmount = 1_000m;

    /// <summary>
    /// Amount dalam IDR dengan presisi internal
    /// </summary>
    public decimal Amount { get; }

    private Money(decimal amount)
    {
        Amount = decimal.Round(amount, InternalDecimalPlaces, MidpointRounding.ToEven);
    }

    /// <summary>
    /// Create Money instance dengan validasi
    /// </summary>
    /// <param name="amount">Amount dalam IDR</param>
    /// <returns>Money instance</returns>
    /// <exception cref="ArgumentException">Jika amount negatif atau melebihi batas</exception>
    public static Money Create(decimal amount)
    {
        if (amount < 0)
            throw new ArgumentException("Amount tidak boleh negatif", nameof(amount));
            
        if (amount > MaxAmount)
            throw new ArgumentException($"Amount melebihi batas maksimum {MaxAmount:N0}", nameof(amount));
            
        return new Money(amount);
    }

    /// <summary>
    /// Create Money dari long (untuk backward compatibility dengan existing code)
    /// </summary>
    public static Money FromLong(long amount) => Create(amount);

    /// <summary>
    /// Create Money zero
    /// </summary>
    public static Money Zero => new(0m);

    /// <summary>
    /// Konversi ke long untuk storage (backward compatibility)
    /// </summary>
    public long ToLong() => (long)decimal.Round(Amount, 0, MidpointRounding.ToEven);

    /// <summary>
    /// Round untuk display (tanpa desimal untuk IDR)
    /// </summary>
    public Money RoundForDisplay()
    {
        return new Money(decimal.Round(Amount, DisplayDecimalPlaces, MidpointRounding.ToEven));
    }

    /// <summary>
    /// Tambah amount
    /// </summary>
    /// <exception cref="OverflowException">Jika hasil melebihi MaxAmount</exception>
    public Money Add(Money other)
    {
        var result = Amount + other.Amount;
        if (result > MaxAmount)
            throw new OverflowException($"Hasil penjumlahan melebihi batas maksimum {MaxAmount:N0}");
        return new Money(result);
    }

    /// <summary>
    /// Kurangi amount
    /// </summary>
    /// <exception cref="InvalidOperationException">Jika hasil negatif</exception>
    public Money Subtract(Money other)
    {
        var result = Amount - other.Amount;
        if (result < 0)
            throw new InvalidOperationException("Hasil pengurangan tidak boleh negatif");
        return new Money(result);
    }

    /// <summary>
    /// Kalikan dengan factor (misal untuk fee calculation)
    /// </summary>
    /// <param name="factor">Factor perkalian (harus non-negatif)</param>
    public Money Multiply(decimal factor)
    {
        if (factor < 0)
            throw new ArgumentException("Factor tidak boleh negatif", nameof(factor));
            
        var result = Amount * factor;
        if (result > MaxAmount)
            throw new OverflowException($"Hasil perkalian melebihi batas maksimum {MaxAmount:N0}");
            
        return new Money(result);
    }

    /// <summary>
    /// Hitung persentase dari amount
    /// </summary>
    /// <param name="percentage">Persentase (misal 2.5 untuk 2.5%)</param>
    public Money CalculatePercentage(decimal percentage)
    {
        if (percentage < 0 || percentage > 100)
            throw new ArgumentException("Persentase harus antara 0 dan 100", nameof(percentage));
            
        return Multiply(percentage / 100m);
    }

    /// <summary>
    /// Check apakah amount mencukupi untuk operasi
    /// </summary>
    public bool HasSufficientBalance(Money required) => Amount >= required.Amount;

    /// <summary>
    /// Check apakah memenuhi minimum transfer
    /// </summary>
    public bool MeetsMinimumTransfer() => Amount >= MinTransferAmount;

    // IEquatable implementation
    public bool Equals(Money other) => Amount == other.Amount;
    public override bool Equals(object? obj) => obj is Money other && Equals(other);
    public override int GetHashCode() => Amount.GetHashCode();

    // IComparable implementation
    public int CompareTo(Money other) => Amount.CompareTo(other.Amount);

    // Operators
    public static bool operator ==(Money left, Money right) => left.Equals(right);
    public static bool operator !=(Money left, Money right) => !left.Equals(right);
    public static bool operator <(Money left, Money right) => left.CompareTo(right) < 0;
    public static bool operator >(Money left, Money right) => left.CompareTo(right) > 0;
    public static bool operator <=(Money left, Money right) => left.CompareTo(right) <= 0;
    public static bool operator >=(Money left, Money right) => left.CompareTo(right) >= 0;
    
    public static Money operator +(Money left, Money right) => left.Add(right);
    public static Money operator -(Money left, Money right) => left.Subtract(right);

    /// <summary>
    /// Format untuk display dengan format Indonesia
    /// </summary>
    public override string ToString()
    {
        var culture = new CultureInfo("id-ID");
        return $"Rp {RoundForDisplay().Amount.ToString("N0", culture)}";
    }

    /// <summary>
    /// Format dengan prefix custom
    /// </summary>
    public string ToString(string prefix)
    {
        var culture = new CultureInfo("id-ID");
        return $"{prefix}{RoundForDisplay().Amount.ToString("N0", culture)}";
    }
}
