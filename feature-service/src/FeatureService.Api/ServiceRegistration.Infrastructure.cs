using Serilog;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Infrastructure.PQC;
using FeatureService.Api.Infrastructure.Idempotency;
using FeatureService.Api.Infrastructure.Audit;
using FeatureService.Api.Infrastructure.Security;
using FeatureService.Api.Services;

namespace FeatureService.Api;

public static class ServiceRegistrationInfrastructure
{
    public static WebApplicationBuilder AddInfrastructureServices(this WebApplicationBuilder builder)
    {
        // MongoDB
        var mongoSettings = new MongoDbSettings();
        builder.Configuration.GetSection("MongoDB").Bind(mongoSettings);
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("MONGODB__CONNECTIONSTRING")))
        {
            mongoSettings.ConnectionString = Environment.GetEnvironmentVariable("MONGODB__CONNECTIONSTRING")!;
        }
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("MONGODB__DATABASENAME")))
        {
            mongoSettings.DatabaseName = Environment.GetEnvironmentVariable("MONGODB__DATABASENAME")!;
        }
    
        builder.Services.AddSingleton(mongoSettings);
        builder.Services.AddSingleton<MongoDbContext>();

        // Post-Quantum Cryptography service
        builder.Services.AddSingleton<IPostQuantumCryptoService, PostQuantumCryptoService>();

        // Hybrid Post-Quantum Cryptography service (PQC + Classical)
        // Combines CRYSTALS-Dilithium3+Ed25519 for signatures and CRYSTALS-Kyber768+ECDH for key encapsulation
        builder.Services.AddSingleton<IHybridCryptoService, HybridCryptoService>();

        // Idempotency service (MongoDB-backed, singleton for index setup)
        builder.Services.AddSingleton<IIdempotencyService, MongoIdempotencyService>();

        // Audit Trail service
        builder.Services.AddScoped<IAuditTrailService, AuditTrailService>();

        // Key Derivation service (HKDF - RFC 5869)
        builder.Services.AddSingleton<IKeyDerivationService, KeyDerivationService>();

        // Key Management service (HSM-ready abstraction, software implementation)
        // For production with high security requirements, replace with HSM-backed implementation
        builder.Services.AddSingleton<IKeyManagementService, SoftwareKeyManagementService>();

        // At-Rest Encryption service
        var encryptionKey = builder.Configuration["Security:MasterEncryptionKey"]
            ?? Environment.GetEnvironmentVariable("SECURITY__MASTERENCRYPTIONKEY");

        if (string.IsNullOrEmpty(encryptionKey))
        {
            Log.Warning("MasterEncryptionKey not configured. Using auto-generated key (not suitable for production).");
        }

        builder.Services.AddSingleton<IAtRestEncryptionService>(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            var logger = sp.GetRequiredService<ILogger<AtRestEncryptionService>>();
            return new AtRestEncryptionService(config, logger);
        });

        // Moderation services
        builder.Services.AddScoped<IReportService, ReportService>();
        builder.Services.AddScoped<IDeviceBanService, DeviceBanService>();
        builder.Services.AddScoped<IUserWarningService, UserWarningService>();
        builder.Services.AddScoped<IAdminModerationService, AdminModerationService>();

        // User cleanup service (for account deletion)
        builder.Services.AddScoped<IUserCleanupService, UserCleanupService>();

        // Document storage service
        builder.Services.AddScoped<IDocumentService, DocumentService>();

        builder.Services.AddHttpClient<IAdminModerationService, AdminModerationService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(30);
        });

        // Health Checks
        builder.Services.AddHealthChecks()
            .AddMongoDb(
                mongoSettings.ConnectionString,
                name: "mongodb",
                timeout: TimeSpan.FromSeconds(3),
                tags: new[] { "db", "mongodb" }
            );

        return builder;
    }
}
