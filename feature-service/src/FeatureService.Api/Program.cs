using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using FluentValidation;
using FluentValidation.AspNetCore;
using Serilog;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Infrastructure.Auth;
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

    // Enable PII logging for debugging JWT issues (remove in production)
    Microsoft.IdentityModel.Logging.IdentityModelEventSource.ShowPII = true;
    Microsoft.IdentityModel.Logging.IdentityModelEventSource.LogCompleteSecurityArtifact = true;

    // Create the signing key once for reuse
    var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Secret))
    {
        KeyId = "go-backend" // Set a KeyId
    };

    // Configure JWT Authentication with support for both user and admin tokens
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            // Use the older JwtSecurityTokenHandler which handles missing kid better
            options.UseSecurityTokenValidators = true;
            
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = false, // Go backend doesn't set issuer
                ValidateAudience = false, // Go backend doesn't set audience
                ValidateLifetime = true,
                ValidateIssuerSigningKey = false, // We use custom SignatureValidator
                RequireSignedTokens = true,
                // Use a custom signature validator that bypasses kid matching
                SignatureValidator = (token, parameters) =>
                {
                    var handler = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler();
                    var jwtToken = handler.ReadJwtToken(token);
                    
                    // Manually compute and verify HMAC-SHA256 signature
                    var parts = token.Split('.');
                    if (parts.Length != 3)
                        throw new SecurityTokenInvalidSignatureException("Invalid token format");
                    
                    var headerAndPayload = $"{parts[0]}.{parts[1]}";
                    var tokenSignature = parts[2];
                    
                    using var hmac = new System.Security.Cryptography.HMACSHA256(
                        Encoding.UTF8.GetBytes(jwtSettings.Secret));
                    var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(headerAndPayload));
                    var computedSignature = Base64UrlEncoder.Encode(hash);
                    
                    // Log for debugging
                    Console.WriteLine($"[JWT DEBUG] Secret len: {jwtSettings.Secret.Length}, first 10: {jwtSettings.Secret.Substring(0, Math.Min(10, jwtSettings.Secret.Length))}");
                    Console.WriteLine($"[JWT DEBUG] Token sig: {tokenSignature.Substring(0, Math.Min(20, tokenSignature.Length))}...");
                    Console.WriteLine($"[JWT DEBUG] Computed:  {computedSignature.Substring(0, Math.Min(20, computedSignature.Length))}...");
                    
                    if (!string.Equals(computedSignature, tokenSignature, StringComparison.Ordinal))
                        throw new SecurityTokenInvalidSignatureException($"Signature mismatch: expected {computedSignature.Substring(0, 20)}... got {tokenSignature.Substring(0, 20)}...");
                    
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
                    // Check if this is an admin token (from Go backend)
                    var tokenType = context.Principal?.FindFirst("type")?.Value;
                    if (tokenType == "admin")
                    {
                        var identity = (System.Security.Claims.ClaimsIdentity?)context.Principal?.Identity;
                        if (identity != null && !context.Principal!.IsInRole("admin"))
                        {
                            identity.AddClaim(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "admin"));
                        }
                        
                        // Map admin_id to NameIdentifier
                        var adminId = context.Principal?.FindFirst("admin_id")?.Value;
                        if (!string.IsNullOrEmpty(adminId) && context.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) == null)
                        {
                            identity?.AddClaim(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.NameIdentifier, adminId));
                        }
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
                                    ValidateIssuer = false,
                                    ValidateAudience = false,
                                    ValidateLifetime = true,
                                    ClockSkew = TimeSpan.FromMinutes(5)
                                };
                                
                                var principal = tokenHandler.ValidateToken(token, validationParameters, out _);
                                var tokenType = principal.FindFirst("type")?.Value;
                                
                                if (tokenType == "admin")
                                {
                                    var identity = (System.Security.Claims.ClaimsIdentity?)principal.Identity;
                                    if (identity != null && !principal.IsInRole("admin"))
                                    {
                                        identity.AddClaim(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "admin"));
                                    }
                                    
                                    var adminId = principal.FindFirst("admin_id")?.Value;
                                    if (!string.IsNullOrEmpty(adminId) && principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier) == null)
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

    // Register services
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<IUserContextAccessor, UserContextAccessor>();
    builder.Services.AddScoped<IReplyService, ReplyService>();
    builder.Services.AddScoped<IReactionService, ReactionService>();
    
    // Register financial services
    builder.Services.AddScoped<IWalletService, WalletService>();
    builder.Services.AddScoped<ITransferService, TransferService>();
    builder.Services.AddHttpClient<ITransferService, TransferService>();
    builder.Services.AddScoped<IDisputeService, DisputeService>();
    builder.Services.AddScoped<IWithdrawalService, WithdrawalService>();

    // Register moderation services
    builder.Services.AddScoped<IReportService, ReportService>();
    builder.Services.AddScoped<IDeviceBanService, DeviceBanService>();
    builder.Services.AddScoped<IUserWarningService, UserWarningService>();
    builder.Services.AddScoped<IAdminModerationService, AdminModerationService>();

    // Register user cleanup service (for account deletion)
    builder.Services.AddScoped<IUserCleanupService, UserCleanupService>();

    // Register document storage service
    builder.Services.AddScoped<IDocumentService, DocumentService>();

    // Register token/wallet service for AI
    builder.Services.AddScoped<ITokenService, TokenService>();

    // Register AI chat services
    builder.Services.AddScoped<IChatService, ChatService>();
    builder.Services.AddScoped<IHuggingFaceService, HuggingFaceService>();
    builder.Services.AddScoped<IExternalLlmService, ExternalLlmService>();

    // Configure HttpClient for external APIs
    builder.Services.AddHttpClient<IHuggingFaceService, HuggingFaceService>(client =>
    {
        client.Timeout = TimeSpan.FromMinutes(2);
    });
    
    builder.Services.AddHttpClient<IExternalLlmService, ExternalLlmService>(client =>
    {
        client.Timeout = TimeSpan.FromMinutes(3);
    });

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
            Description = "Feature Service API untuk AlephDraad - Social & Finance endpoints untuk komunitas investasi Indonesia",
            Contact = new OpenApiContact
            {
                Name = "AlephDraad Team",
                Url = new Uri("https://github.com/alephdraad")
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

    var app = builder.Build();

    // Initialize MongoDB indexes
    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<MongoDbContext>();
        await MongoDbIndexes.CreateIndexesAsync(dbContext);
        Log.Information("MongoDB indexes created successfully");
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

    // Enable Swagger in all environments (protected by auth in production)
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Feature Service API v1");
        c.RoutePrefix = "swagger";
    });

    app.UseCors();

    app.UseAuthentication();
    app.UseAuthorization();

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
