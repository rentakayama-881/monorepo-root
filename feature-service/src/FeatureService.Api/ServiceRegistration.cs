using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using FluentValidation;
using FluentValidation.AspNetCore;
using Serilog;
using FeatureService.Api.Infrastructure.Auth;
using FeatureService.Api.Services;
using FeatureService.Api.Middleware;

namespace FeatureService.Api;

public static class ServiceRegistration
{
    public static WebApplicationBuilder AddFeatureServices(this WebApplicationBuilder builder)
    {
        builder.AddInfrastructureServices();
        builder.AddFinancialServices();

        // JWT
        var jwtSettings = new JwtSettings();
        builder.Configuration.GetSection("Jwt").Bind(jwtSettings);
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
    
        // CORS — load allowed origins from configuration (supports env var overrides via
        // standard ASP.NET Core config: CORS__ALLOWEDORIGINS__0, __1, __2, etc.)
        var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
        if (corsOrigins.Length == 0)
        {
            Log.Warning("No CORS origins configured — API will reject all cross-origin requests");
        }
        else
        {
            Log.Information("CORS allowed origins: {Origins}", string.Join(", ", corsOrigins));
        }
    
        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                policy.WithOrigins(corsOrigins)
                      .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                      .WithHeaders(
                          "Content-Type",
                          "Authorization",
                          "Accept",
                          "X-PQC-Signature",
                          "X-PQC-Key-Id",
                          "X-PQC-Timestamp",
                          "X-Idempotency-Key",
                          "X-Requested-With")
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
                    ClockSkew = TimeSpan.FromMinutes(1)
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
                                        ClockSkew = TimeSpan.FromMinutes(1)
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
                                catch (Exception ex)
                                {
                                    var logger = context.HttpContext.RequestServices.GetService<ILogger<JwtBearerHandler>>();
                                    logger?.LogDebug(ex, "Admin token validation fallback failed");
                                }
                            }
                        }
                        return Task.CompletedTask;
                    }
                };
            });
    
        builder.Services.AddAuthorization();
        builder.Services.AddMemoryCache();
    
        // Register core services
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddScoped<IUserContextAccessor, UserContextAccessor>();
        // Live 2FA verifier — calls Go backend to prevent stale JWT claim bypass
        builder.Services.AddHttpClient<ITwoFactorVerifier, LiveTwoFactorVerifier>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(5);
        });
    
        // Add FluentValidation
        builder.Services.AddFluentValidationAutoValidation();
        builder.Services.AddValidatorsFromAssemblyContaining<Program>();
    
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

        return builder;
    }
}
