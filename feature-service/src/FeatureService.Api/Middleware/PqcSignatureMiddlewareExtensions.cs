namespace FeatureService.Api.Middleware;

/// <summary>
/// Extension methods untuk registrasi PQC Signature Middleware ke pipeline.
/// </summary>
public static class PqcSignatureMiddlewareExtensions
{
    /// <summary>
    /// Menambahkan PQC Signature Middleware ke pipeline.
    /// Middleware ini memvalidasi digital signature PQC pada endpoint yang ditandai [RequiresPqcSignature].
    /// </summary>
    /// <param name="app">Application builder</param>
    /// <returns>Application builder untuk method chaining</returns>
    public static IApplicationBuilder UsePqcSignatureValidation(this IApplicationBuilder app)
    {
        return app.UseMiddleware<PqcSignatureMiddleware>();
    }
}
