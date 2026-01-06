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

    // Configure JWT Authentication
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtSettings.Issuer,
                ValidAudience = jwtSettings.Audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Secret))
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
    // TODO: Add TransferService when implemented

    // Register moderation services
    builder.Services.AddScoped<IReportService, ReportService>();
    builder.Services.AddScoped<IDeviceBanService, DeviceBanService>();
    builder.Services.AddScoped<IUserWarningService, UserWarningService>();
    builder.Services.AddScoped<IAdminModerationService, AdminModerationService>();

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

    builder.Services.AddControllers();
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new OpenApiInfo
        {
            Title = "Feature Service API",
            Version = "v1",
            Description = "Feature Service with Social & Finance endpoints"
        });

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
    app.UseMiddleware<RequestLoggingMiddleware>();
    app.UseMiddleware<ErrorHandlingMiddleware>();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

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
