using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;
using NUlid;

namespace FeatureService.Api.Services;

public interface ITokenService
{
    Task<TokenBalanceDto> GetBalanceAsync(uint userId);
    Task<TokenBalance> GetOrCreateBalanceAsync(uint userId);
    Task<List<TokenPackageDto>> GetPackagesAsync();
    Task<PurchaseTokensResponse> PurchaseTokensAsync(uint userId, string packageId);
    Task<bool> HasSufficientTokensAsync(uint userId, int requiredTokens);
    Task DeductTokensAsync(uint userId, int tokens, string service, string? model, string? chatSessionId);
    Task<TokenUsageHistoryResponse> GetUsageHistoryAsync(uint userId, int limit, string? cursor);
    Task<TokenPurchaseHistoryResponse> GetPurchaseHistoryAsync(uint userId);
}

public class TokenService : ITokenService
{
    private readonly MongoDbContext _context;
    private readonly IWalletService _walletService;
    private readonly ILogger<TokenService> _logger;

    public TokenService(MongoDbContext context, IWalletService walletService, ILogger<TokenService> logger)
    {
        _context = context;
        _walletService = walletService;
        _logger = logger;
    }

    public async Task<TokenBalanceDto> GetBalanceAsync(uint userId)
    {
        var balance = await GetOrCreateBalanceAsync(userId);
        return new TokenBalanceDto(balance.Balance, balance.TotalPurchased, balance.TotalUsed);
    }

    public async Task<TokenBalance> GetOrCreateBalanceAsync(uint userId)
    {
        var balance = await _context.TokenBalances
            .Find(t => t.UserId == userId)
            .FirstOrDefaultAsync();

        if (balance == null)
        {
            balance = new TokenBalance
            {
                Id = $"tkn_{Ulid.NewUlid()}",
                UserId = userId,
                Balance = 0,
                TotalPurchased = 0,
                TotalUsed = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            await _context.TokenBalances.InsertOneAsync(balance);
        }

        return balance;
    }

    public Task<List<TokenPackageDto>> GetPackagesAsync()
    {
        var packages = TokenPackages.All.Select(p => new TokenPackageDto(
            p.Id,
            p.Name,
            p.PriceIdr,
            p.TokenAmount,
            FormatCurrency(p.PriceIdr)
        )).ToList();

        return Task.FromResult(packages);
    }

    public async Task<PurchaseTokensResponse> PurchaseTokensAsync(uint userId, string packageId)
    {
        var package = TokenPackages.GetById(packageId);
        if (package == null)
        {
            throw new ArgumentException("Invalid package ID");
        }

        // Check wallet balance
        var wallet = await _walletService.GetOrCreateWalletAsync(userId);
        if (wallet.Balance < package.PriceIdr)
        {
            throw new InvalidOperationException($"Insufficient wallet balance. Required: {FormatCurrency(package.PriceIdr)}, Available: {FormatCurrency(wallet.Balance)}");
        }

        // Deduct from wallet
        // TODO: Create proper wallet transaction
        // For now, we'll directly update the wallet balance
        var walletUpdate = Builders<UserWallet>.Update
            .Inc(w => w.Balance, -package.PriceIdr)
            .Set(w => w.UpdatedAt, DateTime.UtcNow);
        await _context.Wallets.UpdateOneAsync(w => w.UserId == userId, walletUpdate);

        // Add tokens to balance
        var tokenBalance = await GetOrCreateBalanceAsync(userId);
        var tokenUpdate = Builders<TokenBalance>.Update
            .Inc(t => t.Balance, package.TokenAmount)
            .Inc(t => t.TotalPurchased, package.TokenAmount)
            .Set(t => t.UpdatedAt, DateTime.UtcNow);
        await _context.TokenBalances.UpdateOneAsync(t => t.UserId == userId, tokenUpdate);

        // Record purchase
        var purchase = new TokenPurchase
        {
            Id = $"tpu_{Ulid.NewUlid()}",
            UserId = userId,
            PackageId = packageId,
            AmountPaid = package.PriceIdr,
            TokensReceived = package.TokenAmount,
            WalletTransactionId = null, // TODO: Link to wallet transaction
            CreatedAt = DateTime.UtcNow
        };
        await _context.TokenPurchases.InsertOneAsync(purchase);

        var newBalance = tokenBalance.Balance + package.TokenAmount;

        _logger.LogInformation("Token purchase: User {UserId} bought {Tokens} tokens for {Amount} IDR", 
            userId, package.TokenAmount, package.PriceIdr);

        return new PurchaseTokensResponse(
            purchase.Id,
            package.TokenAmount,
            newBalance,
            $"Successfully purchased {package.TokenAmount} tokens"
        );
    }

    public async Task<bool> HasSufficientTokensAsync(uint userId, int requiredTokens)
    {
        var balance = await GetOrCreateBalanceAsync(userId);
        return balance.Balance >= requiredTokens;
    }

    public async Task DeductTokensAsync(uint userId, int tokens, string service, string? model, string? chatSessionId)
    {
        var balance = await GetOrCreateBalanceAsync(userId);
        if (balance.Balance < tokens)
        {
            throw new InvalidOperationException("Insufficient token balance");
        }

        // Deduct tokens
        var update = Builders<TokenBalance>.Update
            .Inc(t => t.Balance, -tokens)
            .Inc(t => t.TotalUsed, tokens)
            .Set(t => t.UpdatedAt, DateTime.UtcNow);
        await _context.TokenBalances.UpdateOneAsync(t => t.UserId == userId, update);

        // Record usage
        var usage = new TokenUsage
        {
            Id = $"tus_{Ulid.NewUlid()}",
            UserId = userId,
            Service = service,
            Model = model,
            ChatSessionId = chatSessionId,
            InputTokens = 0, // Will be set by caller if needed
            OutputTokens = 0,
            TotalTokens = tokens,
            CreatedAt = DateTime.UtcNow
        };
        await _context.TokenUsages.InsertOneAsync(usage);

        _logger.LogDebug("Token usage: User {UserId} used {Tokens} tokens for {Service}", 
            userId, tokens, service);
    }

    public async Task<TokenUsageHistoryResponse> GetUsageHistoryAsync(uint userId, int limit, string? cursor)
    {
        var filterBuilder = Builders<TokenUsage>.Filter;
        var filter = filterBuilder.Eq(u => u.UserId, userId);

        if (!string.IsNullOrEmpty(cursor))
        {
            filter = filterBuilder.And(filter, filterBuilder.Lt(u => u.Id, cursor));
        }

        var usages = await _context.TokenUsages
            .Find(filter)
            .SortByDescending(u => u.CreatedAt)
            .Limit(limit + 1)
            .ToListAsync();

        var hasMore = usages.Count > limit;
        if (hasMore)
        {
            usages = usages.Take(limit).ToList();
        }

        var nextCursor = hasMore ? usages.Last().Id : null;

        var dtos = usages.Select(u => new TokenUsageDto(
            u.Id,
            u.Service,
            u.Model,
            u.InputTokens,
            u.OutputTokens,
            u.TotalTokens,
            u.CreatedAt
        )).ToList();

        var totalCount = await _context.TokenUsages.CountDocumentsAsync(filterBuilder.Eq(u => u.UserId, userId));

        return new TokenUsageHistoryResponse(dtos, (int)totalCount, nextCursor);
    }

    public async Task<TokenPurchaseHistoryResponse> GetPurchaseHistoryAsync(uint userId)
    {
        var purchases = await _context.TokenPurchases
            .Find(p => p.UserId == userId)
            .SortByDescending(p => p.CreatedAt)
            .ToListAsync();

        var dtos = purchases.Select(p => 
        {
            var package = TokenPackages.GetById(p.PackageId);
            return new TokenPurchaseDto(
                p.Id,
                package?.Name ?? p.PackageId,
                p.AmountPaid,
                p.TokensReceived,
                p.CreatedAt
            );
        }).ToList();

        return new TokenPurchaseHistoryResponse(dtos, purchases.Count);
    }

    private static string FormatCurrency(long amount)
    {
        return $"Rp {amount:N0}".Replace(",", ".");
    }
}
