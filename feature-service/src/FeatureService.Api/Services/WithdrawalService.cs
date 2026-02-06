using MongoDB.Bson;
using MongoDB.Driver;
using FeatureService.Api.Infrastructure.MongoDB;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.DTOs;

namespace FeatureService.Api.Services;

public interface IWithdrawalService
{
    Task<CreateWithdrawalResponse> CreateWithdrawalAsync(uint userId, string username, CreateWithdrawalRequest request);
    Task<List<WithdrawalSummaryDto>> GetUserWithdrawalsAsync(uint userId, WithdrawalStatus? status = null, int limit = 50);
    Task<WithdrawalDto?> GetWithdrawalAsync(string withdrawalId, uint userId);
    Task<(bool success, string? error)> CancelWithdrawalAsync(string withdrawalId, uint userId, string pin);
    Task<List<BankInfoDto>> GetSupportedBanksAsync();
    
    // Admin functions
    Task<List<WithdrawalDto>> GetPendingWithdrawalsAsync(int limit = 50);
    Task<(bool success, string? error)> ProcessWithdrawalAsync(string withdrawalId, uint adminId, string adminUsername, ProcessWithdrawalRequest request);
    Task<WithdrawalStatsDto> GetWithdrawalStatsAsync();
}

public class WithdrawalService : IWithdrawalService
{
    private readonly IMongoCollection<Withdrawal> _withdrawals;
    private readonly IWalletService _walletService;
    private readonly ILogger<WithdrawalService> _logger;

    // Fee configuration - flat fee for withdrawals
    private const long WithdrawalFee = 2500; // Rp2,500 per withdrawal
    private const long MinWithdrawal = 10000; // Minimum Rp10,000
    private const long MaxWithdrawal = 100000000; // Maximum Rp100,000,000

    // Supported Indonesian banks
    private static readonly Dictionary<string, (string Name, string ShortName)> SupportedBanks = new()
    {
        { "BCA", ("Bank Central Asia", "BCA") },
        { "BNI", ("Bank Negara Indonesia", "BNI") },
        { "BRI", ("Bank Rakyat Indonesia", "BRI") },
        { "MANDIRI", ("Bank Mandiri", "Mandiri") },
        { "CIMB", ("CIMB Niaga", "CIMB") },
        { "BTN", ("Bank Tabungan Negara", "BTN") },
        { "DANAMON", ("Bank Danamon", "Danamon") },
        { "PERMATA", ("Bank Permata", "Permata") },
        { "OCBC", ("OCBC NISP", "OCBC") },
        { "MEGA", ("Bank Mega", "Mega") },
        { "BTPN", ("Bank BTPN", "BTPN") },
        { "JAGO", ("Bank Jago", "Jago") },
        { "SEABANK", ("SeaBank Indonesia", "SeaBank") },
        { "BNC", ("Bank Neo Commerce", "BNC") },
        { "GOPAY", ("GoPay", "GoPay") },
        { "OVO", ("OVO", "OVO") },
        { "DANA", ("DANA", "DANA") },
        { "SHOPEEPAY", ("ShopeePay", "ShopeePay") }
    };

    public WithdrawalService(
        MongoDbContext dbContext,
        IWalletService walletService,
        ILogger<WithdrawalService> logger)
    {
        _withdrawals = dbContext.GetCollection<Withdrawal>("withdrawals");
        _walletService = walletService;
        _logger = logger;
    }

    public async Task<CreateWithdrawalResponse> CreateWithdrawalAsync(
        uint userId, string username, CreateWithdrawalRequest request)
    {
        // Validate amount
        if (request.Amount < MinWithdrawal)
            return new CreateWithdrawalResponse(false, null, null, $"Minimal penarikan Rp{MinWithdrawal:N0}");
        
        if (request.Amount > MaxWithdrawal)
            return new CreateWithdrawalResponse(false, null, null, $"Maksimal penarikan Rp{MaxWithdrawal:N0}");

        // Validate bank
        if (!SupportedBanks.TryGetValue(request.BankCode.ToUpperInvariant(), out var bankInfo))
            return new CreateWithdrawalResponse(false, null, null, "Bank tidak didukung");

        // Verify PIN
        var pinResult = await _walletService.VerifyPinAsync(userId, request.Pin);
        if (!pinResult.Valid)
            return new CreateWithdrawalResponse(false, null, null, pinResult.Message);

        // Check balance (amount + fee)
        var wallet = await _walletService.GetOrCreateWalletAsync(userId);

        var totalDeduction = request.Amount + WithdrawalFee;
        if (wallet.Balance < totalDeduction)
            return new CreateWithdrawalResponse(false, null, null, 
                $"Saldo tidak cukup. Diperlukan Rp{totalDeduction:N0} (termasuk fee Rp{WithdrawalFee:N0})");

        // Check for pending withdrawal
        var pendingCount = await _withdrawals.CountDocumentsAsync(
            w => w.UserId == userId && (w.Status == WithdrawalStatus.Pending || w.Status == WithdrawalStatus.Processing)
        );
        if (pendingCount > 0)
            return new CreateWithdrawalResponse(false, null, null, 
                "Anda memiliki penarikan yang sedang diproses. Harap tunggu hingga selesai.");

        // Generate IDs before deduction so we can link transactions
        var withdrawalId = ObjectId.GenerateNewId().ToString();
        var reference = GenerateReference();

        // Deduct from wallet
        var (success, error, _) = await _walletService.DeductBalanceAsync(
            userId,
            totalDeduction,
            $"Penarikan ke {bankInfo.ShortName} ***{request.AccountNumber[^4..]}",
            TransactionType.Withdrawal,
            withdrawalId,
            "withdrawal"
        );

        if (!success)
        {
            return new CreateWithdrawalResponse(false, null, null, error ?? "Gagal memproses penarikan");
        }

        var withdrawal = new Withdrawal
        {
            Id = withdrawalId,
            UserId = userId,
            Username = username,
            Amount = request.Amount,
            Fee = WithdrawalFee,
            NetAmount = request.Amount, // Net amount to be sent to bank
            BankCode = request.BankCode.ToUpperInvariant(),
            BankName = bankInfo.Name,
            AccountNumber = request.AccountNumber,
            AccountName = request.AccountName,
            Status = WithdrawalStatus.Pending,
            Reference = reference,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        try
        {
            await _withdrawals.InsertOneAsync(withdrawal);
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            // Likely violated "one active withdrawal per user" rule (partial unique index).
            _logger.LogWarning(
                ex,
                "Duplicate active withdrawal detected for user {UserId}. Refunding deduction for withdrawal {WithdrawalId}",
                userId,
                withdrawalId);

            try
            {
                _ = await _walletService.AddBalanceAsync(
                    userId,
                    totalDeduction,
                    $"Refund: duplicate withdrawal request {reference}",
                    TransactionType.Refund,
                    withdrawalId,
                    "withdrawal"
                );
            }
            catch (Exception refundEx)
            {
                _logger.LogCritical(
                    refundEx,
                    "CRITICAL: Failed to refund after duplicate withdrawal insert failure. WithdrawalId: {WithdrawalId}, UserId: {UserId}, Amount: {Amount}",
                    withdrawalId,
                    userId,
                    totalDeduction);
            }

            return new CreateWithdrawalResponse(false, null, null,
                "Anda memiliki penarikan yang sedang diproses. Harap tunggu hingga selesai.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to insert withdrawal {WithdrawalId} after wallet deduction; attempting refund", withdrawalId);

            try
            {
                _ = await _walletService.AddBalanceAsync(
                    userId,
                    totalDeduction,
                    $"Refund: gagal membuat penarikan {reference}",
                    TransactionType.Refund,
                    withdrawalId,
                    "withdrawal"
                );
            }
            catch (Exception refundEx)
            {
                _logger.LogCritical(
                    refundEx,
                    "CRITICAL: Failed to refund after withdrawal insert failure. WithdrawalId: {WithdrawalId}, UserId: {UserId}, Amount: {Amount}",
                    withdrawalId,
                    userId,
                    totalDeduction);
            }

            throw;
        }

        _logger.LogInformation(
            "Withdrawal created: {WithdrawalId}, user: {UserId}, amount: {Amount}, bank: {Bank}",
            withdrawal.Id, userId, request.Amount, bankInfo.ShortName
        );

        return new CreateWithdrawalResponse(true, withdrawal.Id, reference, null);
    }

    public async Task<List<WithdrawalSummaryDto>> GetUserWithdrawalsAsync(
        uint userId, WithdrawalStatus? status = null, int limit = 50)
    {
        var filter = Builders<Withdrawal>.Filter.Eq(w => w.UserId, userId);

        if (status.HasValue)
        {
            filter = Builders<Withdrawal>.Filter.And(
                filter,
                Builders<Withdrawal>.Filter.Eq(w => w.Status, status.Value)
            );
        }

        var withdrawals = await _withdrawals
            .Find(filter)
            .SortByDescending(w => w.CreatedAt)
            .Limit(limit)
            .ToListAsync();

        return withdrawals.Select(w => new WithdrawalSummaryDto(
            w.Id,
            w.Amount,
            w.NetAmount,
            SupportedBanks.GetValueOrDefault(w.BankCode).ShortName ?? w.BankCode,
            w.Status.ToString(),
            w.Reference,
            w.CreatedAt
        )).ToList();
    }

    public async Task<WithdrawalDto?> GetWithdrawalAsync(string withdrawalId, uint userId)
    {
        var withdrawal = await _withdrawals.Find(w => w.Id == withdrawalId).FirstOrDefaultAsync();
        
        if (withdrawal == null || withdrawal.UserId != userId)
            return null;

        return MapToDto(withdrawal);
    }

    public async Task<(bool success, string? error)> CancelWithdrawalAsync(
        string withdrawalId, uint userId, string pin)
    {
        var withdrawal = await _withdrawals.Find(w => w.Id == withdrawalId).FirstOrDefaultAsync();
        
        if (withdrawal == null || withdrawal.UserId != userId)
            return (false, "Penarikan tidak ditemukan");

        if (withdrawal.Status != WithdrawalStatus.Pending)
            return (false, "Hanya penarikan dengan status pending yang bisa dibatalkan");

        // Verify PIN
        var pinResult = await _walletService.VerifyPinAsync(userId, pin);
        if (!pinResult.Valid)
            return (false, pinResult.Message);

        var now = DateTime.UtcNow;

        // Update status first to prevent double-refund
        var updateFilter = Builders<Withdrawal>.Filter.And(
            Builders<Withdrawal>.Filter.Eq(w => w.Id, withdrawalId),
            Builders<Withdrawal>.Filter.Eq(w => w.UserId, userId),
            Builders<Withdrawal>.Filter.Eq(w => w.Status, WithdrawalStatus.Pending));

        var statusUpdate = Builders<Withdrawal>.Update
            .Set(w => w.Status, WithdrawalStatus.Cancelled)
            .Set(w => w.UpdatedAt, now);

        var updateResult = await _withdrawals.UpdateOneAsync(updateFilter, statusUpdate);
        if (updateResult.ModifiedCount == 0)
            return (false, "Penarikan sudah diproses oleh request lain");

        // Refund full amount (including fee)
        var totalRefund = withdrawal.Amount + withdrawal.Fee;
        try
        {
            _ = await _walletService.AddBalanceAsync(
                userId,
                totalRefund,
                $"Pembatalan penarikan {withdrawal.Reference}",
                TransactionType.Refund,
                withdrawalId,
                "withdrawal"
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refund cancelled withdrawal {WithdrawalId}. Attempting status rollback.", withdrawalId);

            try
            {
                var rollback = Builders<Withdrawal>.Update
                    .Set(w => w.Status, WithdrawalStatus.Pending)
                    .Set(w => w.UpdatedAt, DateTime.UtcNow);

                await _withdrawals.UpdateOneAsync(
                    Builders<Withdrawal>.Filter.And(
                        Builders<Withdrawal>.Filter.Eq(w => w.Id, withdrawalId),
                        Builders<Withdrawal>.Filter.Eq(w => w.Status, WithdrawalStatus.Cancelled)),
                    rollback);
            }
            catch (Exception rollbackEx)
            {
                _logger.LogCritical(
                    rollbackEx,
                    "CRITICAL: Failed to rollback withdrawal status after refund failure. WithdrawalId: {WithdrawalId}",
                    withdrawalId);
            }

            return (false, "Gagal mengembalikan dana. Silakan coba lagi atau hubungi support.");
        }

        _logger.LogInformation("Withdrawal cancelled: {WithdrawalId} by user {UserId}", withdrawalId, userId);

        return (true, null);
    }

    public Task<List<BankInfoDto>> GetSupportedBanksAsync()
    {
        var banks = SupportedBanks.Select(b => new BankInfoDto(
            b.Key,
            b.Value.Name,
            b.Value.ShortName
        )).ToList();

        return Task.FromResult(banks);
    }

    // ==================
    // ADMIN FUNCTIONS
    // ==================

    public async Task<List<WithdrawalDto>> GetPendingWithdrawalsAsync(int limit = 50)
    {
        var withdrawals = await _withdrawals
            .Find(w => w.Status == WithdrawalStatus.Pending)
            .SortBy(w => w.CreatedAt) // FIFO processing
            .Limit(limit)
            .ToListAsync();

        return withdrawals.Select(MapToDto).ToList();
    }

    public async Task<(bool success, string? error)> ProcessWithdrawalAsync(
        string withdrawalId, uint adminId, string adminUsername, ProcessWithdrawalRequest request)
    {
        var withdrawal = await _withdrawals.Find(w => w.Id == withdrawalId).FirstOrDefaultAsync();
        
        if (withdrawal == null)
            return (false, "Penarikan tidak ditemukan");

        if (withdrawal.Status != WithdrawalStatus.Pending && withdrawal.Status != WithdrawalStatus.Processing)
            return (false, "Penarikan tidak dalam status yang bisa diproses");

        if (request.Approve)
        {
            // Mark as completed
            var update = Builders<Withdrawal>.Update
                .Set(w => w.Status, WithdrawalStatus.Completed)
                .Set(w => w.ProcessedById, adminId)
                .Set(w => w.ProcessedByUsername, adminUsername)
                .Set(w => w.ProcessedAt, DateTime.UtcNow)
                .Set(w => w.UpdatedAt, DateTime.UtcNow);

            await _withdrawals.UpdateOneAsync(w => w.Id == withdrawalId, update);

            _logger.LogInformation(
                "Withdrawal approved: {WithdrawalId} by admin {AdminId}",
                withdrawalId, adminId
            );
        }
        else
        {
            if (string.IsNullOrWhiteSpace(request.RejectionReason))
                return (false, "Alasan penolakan wajib diisi");

            // Refund full amount
            var totalRefund = withdrawal.Amount + withdrawal.Fee;
            _ = await _walletService.AddBalanceAsync(
                withdrawal.UserId,
                totalRefund,
                $"Penolakan penarikan: {request.RejectionReason}",
                TransactionType.Refund,
                withdrawalId,
                "withdrawal"
            );

            var update = Builders<Withdrawal>.Update
                .Set(w => w.Status, WithdrawalStatus.Rejected)
                .Set(w => w.RejectionReason, request.RejectionReason)
                .Set(w => w.ProcessedById, adminId)
                .Set(w => w.ProcessedByUsername, adminUsername)
                .Set(w => w.ProcessedAt, DateTime.UtcNow)
                .Set(w => w.UpdatedAt, DateTime.UtcNow);

            await _withdrawals.UpdateOneAsync(w => w.Id == withdrawalId, update);

            _logger.LogInformation(
                "Withdrawal rejected: {WithdrawalId} by admin {AdminId}, reason: {Reason}",
                withdrawalId, adminId, request.RejectionReason
            );
        }

        return (true, null);
    }

    public async Task<WithdrawalStatsDto> GetWithdrawalStatsAsync()
    {
        var all = await _withdrawals.Find(_ => true).ToListAsync();

        return new WithdrawalStatsDto(
            all.Count,
            all.Sum(w => w.Amount),
            all.Count(w => w.Status == WithdrawalStatus.Pending),
            all.Count(w => w.Status == WithdrawalStatus.Completed),
            all.Count(w => w.Status == WithdrawalStatus.Rejected)
        );
    }

    // ==================
    // HELPERS
    // ==================

    private static string GenerateReference()
    {
        // Format: WD + YYMMDD + 6 random chars
        var date = DateTime.UtcNow.ToString("yyMMdd");
        var random = Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
        return $"WD{date}{random}";
    }

    private static WithdrawalDto MapToDto(Withdrawal w)
    {
        // Mask account number (show only last 4 digits)
        var maskedAccount = w.AccountNumber.Length > 4
            ? new string('*', w.AccountNumber.Length - 4) + w.AccountNumber[^4..]
            : w.AccountNumber;

        return new WithdrawalDto(
            w.Id,
            w.UserId,
            w.Username,
            w.Amount,
            w.Fee,
            w.NetAmount,
            w.BankCode,
            SupportedBanks.GetValueOrDefault(w.BankCode).Name ?? w.BankName,
            maskedAccount,
            w.AccountName,
            w.Status.ToString(),
            w.Reference,
            w.RejectionReason,
            w.CreatedAt,
            w.ProcessedAt
        );
    }
}
