using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using FluentValidation;
using FluentValidation.AspNetCore;
using Serilog;
using StackExchange.Redis;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Infrastructure.Auth;
using FeatureService.Api.Infrastructure.Redis;
using FeatureService.Api.Infrastructure.PQC;
using FeatureService.Api.Infrastructure.Idempotency;
using FeatureService.Api.Infrastructure.Audit;
using FeatureService.Api.Infrastructure.Security;
using FeatureService.Api.Services;
using FeatureService.Api.Middleware;

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateLogger();

try
{
    Log.Information("Starting Feature Service");

    var builder = WebApplication.CreateBuilder(args);

    // Add Serilog
    builder.Host.UseSerilog();

    // Configure MongoDB settings
    var mongoSettings = new MongoDbSettings();
    builder.Configuration.GetSection("MongoDB").Bind(mongoSettings);

    // Override with environment variables if present
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

    // Configure JWT settings
    var jwtSettings = new JwtSettings();
    builder.Configuration.GetSection("Jwt").Bind(jwtSettings);

    // Override with environment variables if present
    if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("JWT__SECRET")))
    {
        jwtSettings.Secret = Environment.GetEnvironmentVariable("JWT__SECRET")!;
    }
    if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("JWT__ISSUER")))
    {
        jwtSettings.Issuer = Environment.GetEnvironmentVariable("JWT__ISSUER")!;
    }
    if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("JWT__AUDIENCE")))
    {
        jwtSettings.Audience = Environment.GetEnvironmentVariable("JWT__AUDIENCE")!;
    }

    if (string.IsNullOrEmpty(jwtSettings.Secret))
    {
        throw new InvalidOperationException("JWT Secret is not configured. Set JWT__SECRET environment variable.");
    }

    builder.Services.AddSingleton(jwtSettings);

    // Configure CORS
    var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
    var envCorsOrigin = Environment.GetEnvironmentVariable("CORS__ALLOWEDORIGINS__0");
    if (!string.IsNullOrEmpty(envCorsOrigin))
    {
        corsOrigins = new[] { envCorsOrigin };
    }

    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
        {
            policy.WithOrigins(corsOrigins)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        });
    });

    // Best practice: don't log PII / full security artifacts in production.
    // Allow explicitly enabling via env var for incident debugging.
    var enableJwtPiiLogging =
        builder.Environment.IsDevelopment()
        || string.Equals(
            Environment.GetEnvironmentVariable("ENABLE_JWT_PII_LOGGING"),
            "true",
            StringComparison.OrdinalIgnoreCase);

    Microsoft.IdentityModel.Logging.IdentityModelEventSource.ShowPII = enableJwtPiiLogging;
    Microsoft.IdentityModel.Logging.IdentityModelEventSource.LogCompleteSecurityArtifact = enableJwtPiiLogging;
    if (enableJwtPiiLogging && !builder.Environment.IsDevelopment())
    {
        Log.Warning("ENABLE_JWT_PII_LOGGING is enabled outside Development. Disable after debugging.");
    }

    var enableJwtDebug =
        builder.Environment.IsDevelopment()
        || string.Equals(
            Environment.GetEnvironmentVariable("ENABLE_JWT_DEBUG"),
            "true",
            StringComparison.OrdinalIgnoreCase);

    // Create the signing key once for reuse
    var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Secret))
    {
        KeyId = "go-backend" // Set a KeyId
    };

    // Configure JWT Authentication with support for both user and admin tokens
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            var validateIssuer = jwtSettings.ValidateIssuer && !string.IsNullOrWhiteSpace(jwtSettings.Issuer);
            var validateAudience = jwtSettings.ValidateAudience && !string.IsNullOrWhiteSpace(jwtSettings.Audience);

            // Use the older JwtSecurityTokenHandler which handles missing kid better
            options.UseSecurityTokenValidators = true;

            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = validateIssuer,
                ValidIssuer = jwtSettings.Issuer,
                ValidateAudience = validateAudience,
                ValidAudience = jwtSettings.Audience,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = false, // We use custom SignatureValidator
                RequireSignedTokens = true,
                // Use a custom signature validator that bypasses kid matching
                SignatureValidator = (token, parameters) =>
                {
                    var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
                    var jwtToken = handler.ReadJwtToken(token);

                    if (!string.Equals(jwtToken.Header.Alg, SecurityAlgorithms.HmacSha256, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new SecurityTokenInvalidAlgorithmException("Unsupported token signing algorithm");
                    }

                    // Manually compute and verify HMAC-SHA256 signature
                    var parts = token.Split('.');
                    if (parts.Length != 3)
                        throw new SecurityTokenInvalidSignatureException("Invalid token format");

                    var headerAndPayload = $"{parts[0]}.{parts[1]}";
                    var tokenSignature = parts[2];

                    using var hmac = new System.Security.Cryptography.HMACSHA256(
                        Encoding.UTF8.GetBytes(jwtSettings.Secret));
                    var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(headerAndPayload));
                    byte[] tokenSignatureBytes;
                    try
                    {
                        tokenSignatureBytes = Base64UrlEncoder.DecodeBytes(tokenSignature);
                    }
                    catch
                    {
                        throw new SecurityTokenInvalidSignatureException("Invalid token signature encoding");
                    }

                    if (enableJwtDebug)
                    {
                        // Avoid logging the secret or full token in any environment.
                        Log.Debug("[JWT DEBUG] Secret length: {SecretLen}", jwtSettings.Secret.Length);
                        Log.Debug("[JWT DEBUG] Token sig prefix: {SigPrefix}", tokenSignature.Substring(0, Math.Min(20, tokenSignature.Length)));
                        var computedSignature = Base64UrlEncoder.Encode(hash);
                        Log.Debug("[JWT DEBUG] Computed prefix: {SigPrefix}", computedSignature.Substring(0, Math.Min(20, computedSignature.Length)));
                    }

                    if (tokenSignatureBytes.Length != hash.Length
                        || !System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(tokenSignatureBytes, hash))
                    {
                        throw new SecurityTokenInvalidSignatureException("Signature mismatch");
                    }

                    return jwtToken;
                },
                // ClockSkew to handle time differences
                ClockSkew = TimeSpan.FromMinutes(5)
            };

            // Custom token validation to also support admin tokens from Go backend
            options.Events = new JwtBearerEvents
            {
                OnTokenValidated = context =>
                {
                    var principal = context.Principal;
                    var identity = (System.Security.Claims.ClaimsIdentity?)principal?.Identity;
                    if (principal == null || identity == null)
                    {
                        context.Fail("Invalid principal");
                        return Task.CompletedTask;
                    }

                    var tokenType = principal.FindFirst("type")?.Value?.Trim().ToLowerInvariant();
                    if (tokenType == "admin")
                    {
                        var adminId = principal.FindFirst("admin_id")?.Value;
                        if (string.IsNullOrWhiteSpace(adminId) || !uint.TryParse(adminId, out _))
                        {
                            context.Fail("Invalid admin token claims");
                            return Task.CompletedTask;
                        }

                        if (!principal.IsInRole("admin"))
                        {
                            identity.AddClaim(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "admin"));
                        }

                        if (principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) == null)
                        {
                            identity.AddClaim(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.NameIdentifier, adminId));
                        }

                        return Task.CompletedTask;
                    }

                    if (!string.IsNullOrEmpty(tokenType) && tokenType != "access")
                    {
                        context.Fail("Invalid token type");
                        return Task.CompletedTask;
                    }

                    // User tokens must carry an ID claim (legacy tokens without explicit type are still allowed).
                    var userId = principal.FindFirst("user_id")?.Value
                        ?? principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                        ?? principal.FindFirst("sub")?.Value;

                    if (string.IsNullOrWhiteSpace(userId) || !uint.TryParse(userId, out _))
                    {
                        context.Fail("Invalid user token claims");
                    }

                    return Task.CompletedTask;
                },
                OnAuthenticationFailed = context =>
                {
                    // If main validation failed, try with admin secret
                    var adminSecret = jwtSettings.AdminSecret;
                    if (string.IsNullOrEmpty(adminSecret))
                    {
                        adminSecret = Environment.GetEnvironmentVariable("ADMIN_JWT_SECRET") ?? "";
                    }

                    if (!string.IsNullOrEmpty(adminSecret) && context.Request.Headers.TryGetValue("Authorization", out var authHeader))
                    {
                        var headerValue = authHeader.ToString();
                        if (headerValue.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                        {
                            var token = headerValue.Substring("Bearer ".Length).Trim();
                            try
                            {
                                var tokenHandler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
                                var key = Encoding.UTF8.GetBytes(adminSecret);
                                var validationParameters = new TokenValidationParameters
                                {
                                    ValidateIssuerSigningKey = true,
                                    IssuerSigningKey = new SymmetricSecurityKey(key),
                                    ValidateIssuer = validateIssuer,
                                    ValidIssuer = jwtSettings.Issuer,
                                    ValidateAudience = validateAudience,
                                    ValidAudience = jwtSettings.Audience,
                                    ValidateLifetime = true,
                                    ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },
                                    ClockSkew = TimeSpan.FromMinutes(5)
                                };

                                var principal = tokenHandler.ValidateToken(token, validationParameters, out _);
                                var tokenType = principal.FindFirst("type")?.Value;

                                if (tokenType == "admin")
                                {
                                    var adminId = principal.FindFirst("admin_id")?.Value;
                                    if (string.IsNullOrWhiteSpace(adminId) || !uint.TryParse(adminId, out _))
                                    {
                                        return Task.CompletedTask;
                                    }

                                    var identity = (System.Security.Claims.ClaimsIdentity?)principal.Identity;
                                    if (identity != null && !principal.IsInRole("admin"))
                                    {
                                        identity.AddClaim(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "admin"));
                                    }

                                    if (principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) == null)
                                    {
                                        identity?.AddClaim(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.NameIdentifier, adminId));
                                    }

                                    context.Principal = principal;
                                    context.Success();
                                }
                            }
                            catch { /* Ignore if admin token validation also fails */ }
                        }
                    }
                    return Task.CompletedTask;
                }
            };
        });

    builder.Services.AddAuthorization();
    builder.Services.AddMemoryCache();

    // Register services
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<IUserContextAccessor, UserContextAccessor>();
    // Live 2FA verifier — calls Go backend to prevent stale JWT claim bypass
    builder.Services.AddHttpClient<ITwoFactorVerifier, LiveTwoFactorVerifier>(client =>
    {
        client.Timeout = TimeSpan.FromSeconds(5);
    });

    // Register financial services
    builder.Services.AddScoped<IWalletService, WalletService>();
    builder.Services.AddScoped<IGuaranteeService, GuaranteeService>();
    builder.Services.AddHttpClient<IGuaranteeService, GuaranteeService>();
    builder.Services.AddScoped<IDepositService, DepositService>();
    builder.Services.AddScoped<ILedgerBackfillService, LedgerBackfillService>();
    builder.Services.AddScoped<ITransferService, TransferService>();
    builder.Services.AddHttpClient<ITransferService, TransferService>();
    builder.Services.AddHostedService<TransferAutoReleaseHostedService>();
    builder.Services.AddScoped<IDisputeService, DisputeService>();
    builder.Services.AddScoped<IWithdrawalService, WithdrawalService>();

    // Configure Redis Sentinel for idempotency
    var redisSettings = new RedisSettings();
    builder.Configuration.GetSection("Redis").Bind(redisSettings);

    // Override with environment variables if present
    // NOTE: We use uppercase env vars in deployment (.env via systemd EnvironmentFile),
    // so read them explicitly instead of relying on the default config binder.
    var envRedisConnectionString =
        Environment.GetEnvironmentVariable("REDIS__CONNECTIONSTRING")
        ?? Environment.GetEnvironmentVariable("REDIS__URL")
        ?? Environment.GetEnvironmentVariable("REDIS_URL");
    if (!string.IsNullOrEmpty(envRedisConnectionString))
    {
        redisSettings.ConnectionString = envRedisConnectionString!;
    }

    if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("REDIS__DIRECTENDPOINT")))
    {
        redisSettings.DirectEndpoint = Environment.GetEnvironmentVariable("REDIS__DIRECTENDPOINT")!;
    }

    var envRedisSentinels = Environment.GetEnvironmentVariable("REDIS__SENTINELENDPOINTS");
    if (!string.IsNullOrEmpty(envRedisSentinels))
    {
        redisSettings.SentinelEndpoints = envRedisSentinels!
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }

    if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("REDIS__SERVICENAME")))
    {
        redisSettings.ServiceName = Environment.GetEnvironmentVariable("REDIS__SERVICENAME")!;
    }
    var envRedisUser =
        Environment.GetEnvironmentVariable("REDIS__USER")
        ?? Environment.GetEnvironmentVariable("REDIS__USERNAME");
    if (!string.IsNullOrEmpty(envRedisUser))
    {
        redisSettings.User = envRedisUser!;
    }
    if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("REDIS__PASSWORD")))
    {
        redisSettings.Password = Environment.GetEnvironmentVariable("REDIS__PASSWORD")!;
    }
    var envRequireTls = Environment.GetEnvironmentVariable("REDIS__REQUIRETLS");
    if (!string.IsNullOrEmpty(envRequireTls) && bool.TryParse(envRequireTls, out var requireTls))
    {
        redisSettings.RequireTls = requireTls;
    }
    if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("REDIS__SSLHOST")))
    {
        redisSettings.SslHost = Environment.GetEnvironmentVariable("REDIS__SSLHOST")!;
    }

    builder.Services.AddSingleton(redisSettings);
    builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
    {
        var settings = sp.GetRequiredService<RedisSettings>();
        var logger = sp.GetRequiredService<ILogger<Program>>();
        return RedisConnectionFactory.CreateConnection(settings, logger);
    });

    // Register Post-Quantum Cryptography service
    builder.Services.AddSingleton<IPostQuantumCryptoService, PostQuantumCryptoService>();

    // Register Hybrid Post-Quantum Cryptography service (PQC + Classical)
    // Combines CRYSTALS-Dilithium3+Ed25519 for signatures and CRYSTALS-Kyber768+ECDH for key encapsulation
    builder.Services.AddSingleton<IHybridCryptoService, HybridCryptoService>();

    // Register Idempotency service (Redis-based)
    builder.Services.AddScoped<IIdempotencyService, RedisIdempotencyService>();

    // Register Audit Trail service
    builder.Services.AddScoped<IAuditTrailService, AuditTrailService>();

    // Register Key Derivation service (HKDF - RFC 5869)
    builder.Services.AddSingleton<IKeyDerivationService, KeyDerivationService>();

    // Register Key Management service (HSM-ready abstraction, software implementation)
    // For production with high security requirements, replace with HSM-backed implementation
    builder.Services.AddSingleton<IKeyManagementService, SoftwareKeyManagementService>();

    // Register At-Rest Encryption service
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

    // Register Secure Transfer and Withdrawal services (with idempotency and audit)
    builder.Services.AddScoped<ISecureTransferService, SecureTransferService>();
    builder.Services.AddScoped<ISecureWithdrawalService, SecureWithdrawalService>();

    // Register moderation services
    builder.Services.AddScoped<IReportService, ReportService>();
    builder.Services.AddScoped<IDeviceBanService, DeviceBanService>();
    builder.Services.AddScoped<IUserWarningService, UserWarningService>();
    builder.Services.AddScoped<IAdminModerationService, AdminModerationService>();

    // Register user cleanup service (for account deletion)
    builder.Services.AddScoped<IUserCleanupService, UserCleanupService>();

    // Register document storage service
    builder.Services.AddScoped<IDocumentService, DocumentService>();

    builder.Services.AddHttpClient<IAdminModerationService, AdminModerationService>(client =>
    {
        client.Timeout = TimeSpan.FromSeconds(30);
    });

    // Add FluentValidation
    builder.Services.AddFluentValidationAutoValidation();
    builder.Services.AddValidatorsFromAssemblyContaining<Program>();

    // Add Health Checks
    builder.Services.AddHealthChecks()
        .AddMongoDb(
            mongoSettings.ConnectionString,
            name: "mongodb",
            timeout: TimeSpan.FromSeconds(3),
            tags: new[] { "db", "mongodb" }
        );

    builder.Services.AddControllers()
        .AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
            options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
            options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
        });
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new OpenApiInfo
        {
            Title = "Feature Service API",
            Version = "v1",
            Description = "Feature Service API for AIValid - Finance & moderation endpoints for Indonesian investment community",
            Contact = new OpenApiContact
            {
                Name = "AIValid Team",
                Url = new Uri("https://aivalid.id")
            }
        });

        // Include XML comments
        var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
        var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
        if (File.Exists(xmlPath))
        {
            c.IncludeXmlComments(xmlPath);
        }

        // Add JWT authentication to Swagger
        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token.",
            Name = "Authorization",
            In = ParameterLocation.Header,
            Type = SecuritySchemeType.ApiKey,
            Scheme = "Bearer"
        });

        c.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                new OpenApiSecurityScheme
                {
                    Reference = new OpenApiReference
                    {
                        Type = ReferenceType.SecurityScheme,
                        Id = "Bearer"
                    }
                },
                Array.Empty<string>()
            }
        });
    });

    var enableSwagger =
        builder.Environment.IsDevelopment()
        || string.Equals(
            Environment.GetEnvironmentVariable("ENABLE_SWAGGER"),
            "true",
            StringComparison.OrdinalIgnoreCase);

    if (enableSwagger && !builder.Environment.IsDevelopment())
    {
        Log.Warning("Swagger is enabled outside Development via ENABLE_SWAGGER=true.");
    }

    var app = builder.Build();

    // Ensure MongoDbContext is initialized at startup so index creation runs
    // before the first request hits financial/admin endpoints.
    using (var scope = app.Services.CreateScope())
    {
        _ = scope.ServiceProvider.GetRequiredService<MongoDbContext>();
        Log.Information("MongoDB context initialized and indexes ensured");
    }

    // Configure middleware pipeline
    app.UseMiddleware<CorrelationIdMiddleware>();
    app.UseMiddleware<SecurityHeadersMiddleware>();
    app.UseRateLimiting(options =>
    {
        options.MaxRequests = 100;  // 100 requests
        options.WindowSeconds = 60; // per minute
    });
    app.UseMiddleware<RequestLoggingMiddleware>();
    app.UseMiddleware<ErrorHandlingMiddleware>();

    if (enableSwagger)
    {
        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "Feature Service API v1");
            c.RoutePrefix = "swagger";
        });
    }

    app.UseCors();

    app.UseAuthentication();
    app.UseAuthorization();

    // PQC Signature validation for financial endpoints
    // Must be after Authentication so user context is available
    app.UsePqcSignatureValidation();

    app.MapControllers();
    app.MapHealthChecks("/health");

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
