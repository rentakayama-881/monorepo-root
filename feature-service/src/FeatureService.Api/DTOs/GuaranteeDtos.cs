using System.ComponentModel.DataAnnotations;
using FeatureService.Api.Models.Entities;

namespace FeatureService.Api.DTOs;

public record GetGuaranteeResponse(
    uint UserId,
    long Amount,
    GuaranteeStatus? Status,
    DateTime? CreatedAt,
    DateTime? UpdatedAt,
    DateTime? ReleasedAt
);

public class SetGuaranteeRequest
{
    [Required(ErrorMessage = "Jumlah jaminan wajib diisi")]
    [Range(100_000, long.MaxValue, ErrorMessage = "Minimal jaminan adalah Rp 100.000")]
    public long Amount { get; set; }

    [Required(ErrorMessage = "PIN wajib diisi")]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "PIN harus 6 digit")]
    [RegularExpression(@"^\d{6}$", ErrorMessage = "PIN harus berisi angka saja")]
    public string Pin { get; set; } = string.Empty;
}

public class ReleaseGuaranteeRequest
{
    [Required(ErrorMessage = "PIN wajib diisi")]
    [StringLength(6, MinimumLength = 6, ErrorMessage = "PIN harus 6 digit")]
    [RegularExpression(@"^\d{6}$", ErrorMessage = "PIN harus berisi angka saja")]
    public string Pin { get; set; } = string.Empty;
}

