using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.Audit;
using FeatureService.Api.Infrastructure.Idempotency;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using MongoDB.Driver;

namespace FeatureService.Api.Tests.Services;

public class SecureWithdrawalServiceIdempotencyTests
{
    private const string InvalidCachedIdempotencyResultMessage =
        "Data idempotency tidak valid. Permintaan diblokir untuk mencegah duplikasi transaksi.";

    [Fact]
    public async Task CreateWithdrawalAsync_WhenCachedResultJsonMalformed_ReturnsBlockedErrorAndSkipsInnerService()
    {
        const uint userId = 88;
        const string expectedKey = "withdrawal:88:cached-malformed";

        var innerService = new Mock<IWithdrawalService>(MockBehavior.Strict);
        var idempotencyService = new Mock<IIdempotencyService>(MockBehavior.Strict);
        var auditService = new Mock<IAuditTrailService>(MockBehavior.Strict);
        var withdrawals = new Mock<IMongoCollection<Withdrawal>>(MockBehavior.Strict);

        idempotencyService
            .Setup(s => s.TryAcquireAsync(
                expectedKey,
                TimeSpan.FromSeconds(30),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyResult(
                Acquired: false,
                AlreadyProcessed: true,
                StoredResultJson: "{ malformed-json"));

        var sut = CreateSut(
            innerService.Object,
            idempotencyService.Object,
            auditService.Object,
            withdrawals.Object);

        var request = new CreateWithdrawalRequest(
            Amount: 150_000,
            BankCode: "BCA",
            AccountNumber: "1234567890",
            AccountName: "John Doe",
            Pin: "123456");

        var result = await sut.CreateWithdrawalAsync(
            userId,
            "user_88",
            request,
            idempotencyKey: "cached-malformed");

        Assert.False(result.Success);
        Assert.Equal(InvalidCachedIdempotencyResultMessage, result.Error);
        Assert.Null(result.WithdrawalId);
        Assert.Null(result.Reference);

        innerService.Verify(
            s => s.CreateWithdrawalAsync(
                It.IsAny<uint>(),
                It.IsAny<string>(),
                It.IsAny<CreateWithdrawalRequest>()),
            Times.Never);
        idempotencyService.Verify(
            s => s.StoreResultAsync(
                It.IsAny<string>(),
                It.IsAny<object>(),
                It.IsAny<TimeSpan>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
        idempotencyService.Verify(
            s => s.ReleaseAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
        auditService.Verify(
            s => s.RecordEventAsync(It.IsAny<AuditEventRequest>(), It.IsAny<CancellationToken>()),
            Times.Never);
        idempotencyService.VerifyAll();
    }

    [Fact]
    public async Task CreateWithdrawalAsync_WhenCachedSuccessMissingIdentifiers_ReturnsBlockedError()
    {
        const uint userId = 89;
        const string expectedKey = "withdrawal:89:cached-success-invalid";

        var innerService = new Mock<IWithdrawalService>(MockBehavior.Strict);
        var idempotencyService = new Mock<IIdempotencyService>(MockBehavior.Strict);
        var auditService = new Mock<IAuditTrailService>(MockBehavior.Strict);
        var withdrawals = new Mock<IMongoCollection<Withdrawal>>(MockBehavior.Strict);

        idempotencyService
            .Setup(s => s.TryAcquireAsync(
                expectedKey,
                TimeSpan.FromSeconds(30),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyResult(
                Acquired: false,
                AlreadyProcessed: true,
                StoredResultJson: "{\"Success\":true,\"WithdrawalId\":null,\"Reference\":null,\"Error\":null}"));

        var sut = CreateSut(
            innerService.Object,
            idempotencyService.Object,
            auditService.Object,
            withdrawals.Object);

        var request = new CreateWithdrawalRequest(
            Amount: 200_000,
            BankCode: "BNI",
            AccountNumber: "9876543210",
            AccountName: "Jane Doe",
            Pin: "123456");

        var result = await sut.CreateWithdrawalAsync(
            userId,
            "user_89",
            request,
            idempotencyKey: "cached-success-invalid");

        Assert.False(result.Success);
        Assert.Equal(InvalidCachedIdempotencyResultMessage, result.Error);
        Assert.Null(result.WithdrawalId);
        Assert.Null(result.Reference);

        innerService.Verify(
            s => s.CreateWithdrawalAsync(
                It.IsAny<uint>(),
                It.IsAny<string>(),
                It.IsAny<CreateWithdrawalRequest>()),
            Times.Never);
        auditService.Verify(
            s => s.RecordEventAsync(It.IsAny<AuditEventRequest>(), It.IsAny<CancellationToken>()),
            Times.Never);
        idempotencyService.VerifyAll();
    }

    [Fact]
    public async Task CancelWithdrawalAsync_WhenCachedResultIsNull_ReturnsBlockedErrorAndSkipsInnerService()
    {
        const uint userId = 77;
        const string expectedKey = "wd_cancel:77:cached-null";
        const string withdrawalId = "wd_cancel_cached_null";

        var withdrawal = CreatePendingWithdrawal(withdrawalId, userId);

        var innerService = new Mock<IWithdrawalService>(MockBehavior.Strict);
        var idempotencyService = new Mock<IIdempotencyService>(MockBehavior.Strict);
        var auditService = new Mock<IAuditTrailService>(MockBehavior.Strict);
        var withdrawals = new Mock<IMongoCollection<Withdrawal>>(MockBehavior.Strict);

        SetupFindSequence(withdrawals, withdrawal);

        idempotencyService
            .Setup(s => s.TryAcquireAsync(
                expectedKey,
                TimeSpan.FromSeconds(30),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyResult(
                Acquired: false,
                AlreadyProcessed: true,
                StoredResultJson: null));

        var sut = CreateSut(
            innerService.Object,
            idempotencyService.Object,
            auditService.Object,
            withdrawals.Object);

        var (success, error) = await sut.CancelWithdrawalAsync(
            withdrawalId,
            userId,
            pin: "123456",
            idempotencyKey: "cached-null");

        Assert.False(success);
        Assert.Equal(InvalidCachedIdempotencyResultMessage, error);

        innerService.Verify(
            s => s.CancelWithdrawalAsync(It.IsAny<string>(), It.IsAny<uint>(), It.IsAny<string>()),
            Times.Never);
        idempotencyService.Verify(
            s => s.StoreResultAsync(
                It.IsAny<string>(),
                It.IsAny<object>(),
                It.IsAny<TimeSpan>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
        idempotencyService.Verify(
            s => s.ReleaseAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
        auditService.Verify(
            s => s.RecordEventAsync(It.IsAny<AuditEventRequest>(), It.IsAny<CancellationToken>()),
            Times.Never);
        idempotencyService.VerifyAll();
    }

    [Fact]
    public async Task ProcessWithdrawalAsync_WhenCachedPayloadMissingSuccess_ReturnsBlockedErrorAndSkipsInnerService()
    {
        const uint adminId = 55;
        const string expectedKey = "wd_process:55:cached-schema-mismatch";
        const string withdrawalId = "wd_process_cached_schema";

        var withdrawal = CreatePendingWithdrawal(withdrawalId, userId: 12);

        var innerService = new Mock<IWithdrawalService>(MockBehavior.Strict);
        var idempotencyService = new Mock<IIdempotencyService>(MockBehavior.Strict);
        var auditService = new Mock<IAuditTrailService>(MockBehavior.Strict);
        var withdrawals = new Mock<IMongoCollection<Withdrawal>>(MockBehavior.Strict);

        SetupFindSequence(withdrawals, withdrawal);

        idempotencyService
            .Setup(s => s.TryAcquireAsync(
                expectedKey,
                TimeSpan.FromSeconds(30),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyResult(
                Acquired: false,
                AlreadyProcessed: true,
                StoredResultJson: "{\"Error\":\"missing success field\"}"));

        var sut = CreateSut(
            innerService.Object,
            idempotencyService.Object,
            auditService.Object,
            withdrawals.Object);

        var (success, error) = await sut.ProcessWithdrawalAsync(
            withdrawalId,
            adminId,
            "admin_55",
            new ProcessWithdrawalRequest(Approve: true, RejectionReason: null),
            idempotencyKey: "cached-schema-mismatch");

        Assert.False(success);
        Assert.Equal(InvalidCachedIdempotencyResultMessage, error);

        innerService.Verify(
            s => s.ProcessWithdrawalAsync(
                It.IsAny<string>(),
                It.IsAny<uint>(),
                It.IsAny<string>(),
                It.IsAny<ProcessWithdrawalRequest>()),
            Times.Never);
        idempotencyService.Verify(
            s => s.StoreResultAsync(
                It.IsAny<string>(),
                It.IsAny<object>(),
                It.IsAny<TimeSpan>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
        idempotencyService.Verify(
            s => s.ReleaseAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
        auditService.Verify(
            s => s.RecordEventAsync(It.IsAny<AuditEventRequest>(), It.IsAny<CancellationToken>()),
            Times.Never);
        idempotencyService.VerifyAll();
    }

    private static SecureWithdrawalService CreateSut(
        IWithdrawalService innerService,
        IIdempotencyService idempotencyService,
        IAuditTrailService auditService,
        IMongoCollection<Withdrawal> withdrawals)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection()
            .Build();
        var logger = new Mock<ILogger<SecureWithdrawalService>>(MockBehavior.Loose);

        return new SecureWithdrawalService(
            innerService,
            idempotencyService,
            auditService,
            withdrawals,
            configuration,
            logger.Object);
    }

    private static Withdrawal CreatePendingWithdrawal(string id, uint userId)
    {
        return new Withdrawal
        {
            Id = id,
            UserId = userId,
            Username = $"user_{userId}",
            Amount = 100_000,
            Fee = 5_000,
            NetAmount = 95_000,
            BankCode = "BCA",
            BankName = "Bank BCA",
            AccountNumber = "1234567890",
            AccountName = "John Doe",
            Status = WithdrawalStatus.Pending,
            Reference = "WD-REF-001",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private static void SetupFindSequence(
        Mock<IMongoCollection<Withdrawal>> collection,
        params Withdrawal?[] results)
    {
        var setup = collection.SetupSequence(c => c.FindAsync(
            It.IsAny<FilterDefinition<Withdrawal>>(),
            It.IsAny<FindOptions<Withdrawal, Withdrawal>>(),
            It.IsAny<CancellationToken>()));

        foreach (var result in results)
        {
            setup = setup.ReturnsAsync(CreateCursor(result).Object);
        }
    }

    private static Mock<IAsyncCursor<Withdrawal>> CreateCursor(Withdrawal? item)
    {
        var cursor = new Mock<IAsyncCursor<Withdrawal>>(MockBehavior.Strict);
        var batch = item is null ? Array.Empty<Withdrawal>() : new[] { item };

        cursor.SetupGet(c => c.Current).Returns(batch);
        cursor.SetupSequence(c => c.MoveNext(It.IsAny<CancellationToken>()))
            .Returns(true)
            .Returns(false);
        cursor.SetupSequence(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(true)
            .ReturnsAsync(false);
        cursor.Setup(c => c.Dispose());

        return cursor;
    }
}
