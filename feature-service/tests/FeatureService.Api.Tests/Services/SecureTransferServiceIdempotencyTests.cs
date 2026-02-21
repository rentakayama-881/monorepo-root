using System.Text.Json;
using FeatureService.Api.Domain.Entities;
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

public class SecureTransferServiceIdempotencyTests
{
    [Fact]
    public async Task CreateTransferAsync_WhenAlreadyProcessed_ReturnsCachedResultWithoutCallingInnerService()
    {
        const uint senderId = 77;
        const string providedKey = "cached-create";
        const string expectedKey = "transfer:77:cached-create";

        var cachedResult = new CreateTransferResponse(
            TransferId: "trf_cached_001",
            Code: "12345678",
            Amount: 150_000,
            ReceiverUsername: "receiver_99",
            HoldUntil: DateTime.UtcNow.AddDays(3));

        var innerService = new Mock<ITransferService>(MockBehavior.Strict);
        var idempotencyService = new Mock<IIdempotencyService>(MockBehavior.Strict);
        var auditService = new Mock<IAuditTrailService>(MockBehavior.Strict);
        var transfers = new Mock<IMongoCollection<Transfer>>(MockBehavior.Strict);

        idempotencyService
            .Setup(s => s.TryAcquireAsync(
                expectedKey,
                TimeSpan.FromSeconds(30),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyResult(
                Acquired: false,
                AlreadyProcessed: true,
                StoredResultJson: JsonSerializer.Serialize(cachedResult)));

        auditService
            .Setup(s => s.RecordEventAsync(
                It.Is<AuditEventRequest>(request =>
                    request.TransactionId == expectedKey &&
                    request.EventType == AuditEventType.SecurityCheck &&
                    request.ActorUserId == senderId &&
                    request.ActorUsername == "sender_77"),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateAuditTrail());

        var sut = CreateSut(
            innerService.Object,
            idempotencyService.Object,
            auditService.Object,
            transfers.Object);

        var request = new CreateTransferRequest(
            ReceiverUsername: "receiver_99",
            Amount: 150_000,
            Message: "hello",
            Pin: "123456");

        var result = await sut.CreateTransferAsync(
            senderId,
            request,
            idempotencyKey: providedKey,
            senderUsername: "sender_77");

        Assert.Equal(cachedResult.TransferId, result.TransferId);
        Assert.Equal(cachedResult.Code, result.Code);
        Assert.Equal(cachedResult.Amount, result.Amount);
        Assert.Equal(cachedResult.ReceiverUsername, result.ReceiverUsername);

        innerService.Verify(
            s => s.CreateTransferAsync(
                It.IsAny<uint>(),
                It.IsAny<CreateTransferRequest>(),
                It.IsAny<string?>()),
            Times.Never);
        idempotencyService.Verify(
            s => s.ReleaseAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
        idempotencyService.VerifyAll();
        auditService.VerifyAll();
    }

    [Fact]
    public async Task CreateTransferAsync_WhenSameProvidedKeyUsedByDifferentUsers_UsesDistinctScopedCacheEntries()
    {
        const uint senderA = 101;
        const uint senderB = 202;
        const string providedKey = "shared-key";
        const string expectedKeyA = "transfer:101:shared-key";
        const string expectedKeyB = "transfer:202:shared-key";

        var cachedResultA = new CreateTransferResponse(
            TransferId: "trf_cached_a",
            Code: "11112222",
            Amount: 120_000,
            ReceiverUsername: "receiver_a",
            HoldUntil: DateTime.UtcNow.AddDays(1));

        var cachedResultB = new CreateTransferResponse(
            TransferId: "trf_cached_b",
            Code: "33334444",
            Amount: 130_000,
            ReceiverUsername: "receiver_b",
            HoldUntil: DateTime.UtcNow.AddDays(2));

        var innerService = new Mock<ITransferService>(MockBehavior.Strict);
        var idempotencyService = new Mock<IIdempotencyService>(MockBehavior.Strict);
        var auditService = new Mock<IAuditTrailService>(MockBehavior.Strict);
        var transfers = new Mock<IMongoCollection<Transfer>>(MockBehavior.Strict);

        idempotencyService
            .Setup(s => s.TryAcquireAsync(
                expectedKeyA,
                TimeSpan.FromSeconds(30),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyResult(
                Acquired: false,
                AlreadyProcessed: true,
                StoredResultJson: JsonSerializer.Serialize(cachedResultA)));

        idempotencyService
            .Setup(s => s.TryAcquireAsync(
                expectedKeyB,
                TimeSpan.FromSeconds(30),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyResult(
                Acquired: false,
                AlreadyProcessed: true,
                StoredResultJson: JsonSerializer.Serialize(cachedResultB)));

        auditService
            .Setup(s => s.RecordEventAsync(
                It.IsAny<AuditEventRequest>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateAuditTrail());

        var sut = CreateSut(
            innerService.Object,
            idempotencyService.Object,
            auditService.Object,
            transfers.Object);

        var request = new CreateTransferRequest(
            ReceiverUsername: "receiver_any",
            Amount: 100_000,
            Message: "cross user cache isolation",
            Pin: "123456");

        var resultA = await sut.CreateTransferAsync(
            senderA,
            request,
            idempotencyKey: providedKey,
            senderUsername: "sender_a");
        var resultB = await sut.CreateTransferAsync(
            senderB,
            request,
            idempotencyKey: providedKey,
            senderUsername: "sender_b");

        Assert.Equal(cachedResultA.TransferId, resultA.TransferId);
        Assert.Equal(cachedResultB.TransferId, resultB.TransferId);

        innerService.Verify(
            s => s.CreateTransferAsync(
                It.IsAny<uint>(),
                It.IsAny<CreateTransferRequest>(),
                It.IsAny<string?>()),
            Times.Never);
        idempotencyService.Verify(
            s => s.TryAcquireAsync(expectedKeyA, TimeSpan.FromSeconds(30), It.IsAny<CancellationToken>()),
            Times.Once);
        idempotencyService.Verify(
            s => s.TryAcquireAsync(expectedKeyB, TimeSpan.FromSeconds(30), It.IsAny<CancellationToken>()),
            Times.Once);
        auditService.Verify(
            s => s.RecordEventAsync(
                It.Is<AuditEventRequest>(request =>
                    IsDuplicateBlockedAuditEvent(request, expectedKeyA, senderA)),
                It.IsAny<CancellationToken>()),
            Times.Once);
        auditService.Verify(
            s => s.RecordEventAsync(
                It.Is<AuditEventRequest>(request =>
                    IsDuplicateBlockedAuditEvent(request, expectedKeyB, senderB)),
                It.IsAny<CancellationToken>()),
            Times.Once);
        idempotencyService.VerifyAll();
    }

    [Fact]
    public async Task ReleaseTransferAsync_WhenGeneratedKeyCollidesAcrossUsers_UsesDistinctScopedKeys()
    {
        const uint userA = 301;
        const uint userB = 302;
        const string sharedRawGeneratedKey = "generated-key";
        const string expectedKeyA = "release:301:generated-key";
        const string expectedKeyB = "release:302:generated-key";

        var transferA = CreatePendingTransfer("trf_release_generated_a", senderId: 11, receiverId: userA);
        var transferB = CreatePendingTransfer("trf_release_generated_b", senderId: 12, receiverId: userB);

        var innerService = new Mock<ITransferService>(MockBehavior.Strict);
        var idempotencyService = new Mock<IIdempotencyService>(MockBehavior.Strict);
        var auditService = new Mock<IAuditTrailService>(MockBehavior.Strict);
        var transfers = new Mock<IMongoCollection<Transfer>>(MockBehavior.Strict);

        SetupFindSequence(transfers, transferA, transferB);

        idempotencyService
            .SetupSequence(s => s.GenerateKey("release"))
            .Returns(sharedRawGeneratedKey)
            .Returns(sharedRawGeneratedKey);

        idempotencyService
            .Setup(s => s.TryAcquireAsync(
                expectedKeyA,
                TimeSpan.FromSeconds(30),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyResult(
                Acquired: false,
                AlreadyProcessed: true,
                StoredResultJson: CreateOperationResultJson(success: true, error: null)));

        idempotencyService
            .Setup(s => s.TryAcquireAsync(
                expectedKeyB,
                TimeSpan.FromSeconds(30),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyResult(
                Acquired: false,
                AlreadyProcessed: true,
                StoredResultJson: CreateOperationResultJson(
                    success: false,
                    error: "Transfer sudah direlease")));

        var sut = CreateSut(
            innerService.Object,
            idempotencyService.Object,
            auditService.Object,
            transfers.Object);

        var (successA, errorA) = await sut.ReleaseTransferAsync(
            transferA.Id,
            userA,
            pin: "123456");
        var (successB, errorB) = await sut.ReleaseTransferAsync(
            transferB.Id,
            userB,
            pin: "123456");

        Assert.True(successA);
        Assert.Null(errorA);
        Assert.False(successB);
        Assert.Equal("Transfer sudah direlease", errorB);

        innerService.Verify(
            s => s.ReleaseTransferAsync(It.IsAny<string>(), It.IsAny<uint>(), It.IsAny<string>()),
            Times.Never);
        idempotencyService.Verify(
            s => s.GenerateKey("release"),
            Times.Exactly(2));
        idempotencyService.Verify(
            s => s.TryAcquireAsync(expectedKeyA, TimeSpan.FromSeconds(30), It.IsAny<CancellationToken>()),
            Times.Once);
        idempotencyService.Verify(
            s => s.TryAcquireAsync(expectedKeyB, TimeSpan.FromSeconds(30), It.IsAny<CancellationToken>()),
            Times.Once);
        idempotencyService.VerifyAll();
    }

    [Fact]
    public async Task ReleaseTransferAsync_WhenAlreadyProcessed_ReturnsCachedResultAndSkipsInnerService()
    {
        const uint userId = 88;
        const string providedKey = "  cached-release  ";
        const string expectedKey = "release:88:cached-release";
        const string transferId = "trf_release_cached_001";

        var transfer = CreatePendingTransfer(transferId, senderId: 11, receiverId: userId);

        var innerService = new Mock<ITransferService>(MockBehavior.Strict);
        var idempotencyService = new Mock<IIdempotencyService>(MockBehavior.Strict);
        var auditService = new Mock<IAuditTrailService>(MockBehavior.Strict);
        var transfers = new Mock<IMongoCollection<Transfer>>(MockBehavior.Strict);

        SetupFindSequence(transfers, transfer);

        idempotencyService
            .Setup(s => s.TryAcquireAsync(
                expectedKey,
                TimeSpan.FromSeconds(30),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyResult(
                Acquired: false,
                AlreadyProcessed: true,
                StoredResultJson: CreateOperationResultJson(success: true, error: null)));

        var sut = CreateSut(
            innerService.Object,
            idempotencyService.Object,
            auditService.Object,
            transfers.Object);

        var (success, error) = await sut.ReleaseTransferAsync(
            transferId,
            userId,
            pin: "123456",
            idempotencyKey: providedKey);

        Assert.True(success);
        Assert.Null(error);

        innerService.Verify(
            s => s.ReleaseTransferAsync(It.IsAny<string>(), It.IsAny<uint>(), It.IsAny<string>()),
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
    public async Task RejectTransferAsync_WhenAlreadyProcessed_ReturnsCachedFailureAndSkipsInnerService()
    {
        const uint receiverId = 99;
        const string providedKey = "cached-reject";
        const string expectedKey = "reject:99:cached-reject";
        const string transferId = "trf_reject_cached_001";

        var transfer = CreatePendingTransfer(transferId, senderId: 12, receiverId: receiverId);

        var innerService = new Mock<ITransferService>(MockBehavior.Strict);
        var idempotencyService = new Mock<IIdempotencyService>(MockBehavior.Strict);
        var auditService = new Mock<IAuditTrailService>(MockBehavior.Strict);
        var transfers = new Mock<IMongoCollection<Transfer>>(MockBehavior.Strict);

        SetupFindSequence(transfers, transfer);

        idempotencyService
            .Setup(s => s.TryAcquireAsync(
                expectedKey,
                TimeSpan.FromSeconds(30),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyResult(
                Acquired: false,
                AlreadyProcessed: true,
                StoredResultJson: CreateOperationResultJson(
                    success: false,
                    error: "Transfer sudah dibatalkan")));

        var sut = CreateSut(
            innerService.Object,
            idempotencyService.Object,
            auditService.Object,
            transfers.Object);

        var (success, error) = await sut.RejectTransferAsync(
            transferId,
            receiverId,
            pin: "123456",
            reason: "late",
            idempotencyKey: providedKey);

        Assert.False(success);
        Assert.Equal("Transfer sudah dibatalkan", error);

        innerService.Verify(
            s => s.RejectTransferAsync(
                It.IsAny<string>(),
                It.IsAny<uint>(),
                It.IsAny<string>(),
                It.IsAny<string>()),
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
    public async Task ReleaseTransferAsync_WhenLockNotAcquired_ReturnsInProgressErrorAndSkipsInnerService()
    {
        const uint userId = 88;
        const string providedKey = "release-in-flight";
        const string expectedKey = "release:88:release-in-flight";

        var transfer = CreatePendingTransfer("trf_release_001", senderId: 33, receiverId: userId);

        var innerService = new Mock<ITransferService>(MockBehavior.Strict);
        var idempotencyService = new Mock<IIdempotencyService>(MockBehavior.Strict);
        var auditService = new Mock<IAuditTrailService>(MockBehavior.Strict);
        var transfers = new Mock<IMongoCollection<Transfer>>(MockBehavior.Strict);

        SetupFindSequence(transfers, transfer);

        idempotencyService
            .Setup(s => s.TryAcquireAsync(
                expectedKey,
                TimeSpan.FromSeconds(30),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyResult(
                Acquired: false,
                AlreadyProcessed: false,
                StoredResultJson: null));

        var sut = CreateSut(
            innerService.Object,
            idempotencyService.Object,
            auditService.Object,
            transfers.Object);

        var (success, error) = await sut.ReleaseTransferAsync(
            transfer.Id,
            userId,
            pin: "123456",
            idempotencyKey: providedKey);

        Assert.False(success);
        Assert.Equal("Request sudah sedang diproses", error);

        innerService.Verify(
            s => s.ReleaseTransferAsync(It.IsAny<string>(), It.IsAny<uint>(), It.IsAny<string>()),
            Times.Never);
        auditService.Verify(
            s => s.RecordEventAsync(It.IsAny<AuditEventRequest>(), It.IsAny<CancellationToken>()),
            Times.Never);
        idempotencyService.Verify(
            s => s.ReleaseAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
        idempotencyService.VerifyAll();
    }

    [Fact]
    public async Task CancelTransferAsync_WhenInnerServiceThrows_ReleasesIdempotencyLockAndRethrows()
    {
        const uint userId = 22;
        const string providedKey = "cancel-fail";
        const string expectedKey = "cancel:22:cancel-fail";

        var transfer = CreatePendingTransfer("trf_cancel_001", senderId: userId, receiverId: 55);

        var innerService = new Mock<ITransferService>(MockBehavior.Strict);
        var idempotencyService = new Mock<IIdempotencyService>(MockBehavior.Strict);
        var auditService = new Mock<IAuditTrailService>(MockBehavior.Strict);
        var transfers = new Mock<IMongoCollection<Transfer>>(MockBehavior.Strict);

        SetupFindSequence(transfers, transfer);

        idempotencyService
            .Setup(s => s.TryAcquireAsync(
                expectedKey,
                TimeSpan.FromSeconds(30),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IdempotencyResult(
                Acquired: true,
                AlreadyProcessed: false,
                StoredResultJson: null));

        auditService
            .Setup(s => s.RecordEventAsync(
                It.Is<AuditEventRequest>(request =>
                    IsCancelInitiatedAuditEvent(
                        request,
                        transfer.Id,
                        userId,
                        expectedKey)),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateAuditTrail());

        innerService
            .Setup(s => s.CancelTransferAsync(transfer.Id, userId, "123456", "duplicate"))
            .ThrowsAsync(new InvalidOperationException("simulate downstream failure"));

        idempotencyService
            .Setup(s => s.ReleaseAsync(expectedKey, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var sut = CreateSut(
            innerService.Object,
            idempotencyService.Object,
            auditService.Object,
            transfers.Object);

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() => sut.CancelTransferAsync(
            transfer.Id,
            userId,
            pin: "123456",
            reason: "duplicate",
            idempotencyKey: providedKey));

        Assert.Equal("simulate downstream failure", exception.Message);

        idempotencyService.Verify(
            s => s.ReleaseAsync(expectedKey, It.IsAny<CancellationToken>()),
            Times.Once);
        idempotencyService.VerifyAll();
        innerService.VerifyAll();
        auditService.VerifyAll();
    }

    private static SecureTransferService CreateSut(
        ITransferService innerService,
        IIdempotencyService idempotencyService,
        IAuditTrailService auditService,
        IMongoCollection<Transfer> transfers)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection()
            .Build();
        var logger = new Mock<ILogger<SecureTransferService>>(MockBehavior.Loose);

        return new SecureTransferService(
            innerService,
            idempotencyService,
            auditService,
            transfers,
            configuration,
            logger.Object);
    }

    private static Transfer CreatePendingTransfer(string id, uint senderId, uint receiverId)
    {
        return new Transfer
        {
            Id = id,
            Code = "87654321",
            SenderId = senderId,
            SenderUsername = $"sender_{senderId}",
            ReceiverId = receiverId,
            ReceiverUsername = $"receiver_{receiverId}",
            Amount = 100_000,
            Status = TransferStatus.Pending,
            HoldUntil = DateTime.UtcNow.AddHours(3),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
    }

    private static ImmutableAuditTrail CreateAuditTrail()
    {
        return new ImmutableAuditTrail
        {
            Id = $"audit_{Guid.NewGuid():N}",
            TransactionId = "idempotency",
            TransactionType = "TRANSFER",
            EventType = AuditEventType.SecurityCheck,
            ActorUserId = 1,
            ActorUsername = "system",
            PreviousEntryHash = "genesis",
            EntryHash = "hash",
            CreatedAt = DateTime.UtcNow,
            SequenceNumber = 1
        };
    }

    private static void SetupFindSequence(
        Mock<IMongoCollection<Transfer>> collection,
        params Transfer?[] results)
    {
        var setup = collection.SetupSequence(c => c.FindAsync(
            It.IsAny<FilterDefinition<Transfer>>(),
            It.IsAny<FindOptions<Transfer, Transfer>>(),
            It.IsAny<CancellationToken>()));

        foreach (var result in results)
        {
            setup = setup.ReturnsAsync(CreateCursor(result).Object);
        }
    }

    private static Mock<IAsyncCursor<Transfer>> CreateCursor(Transfer? item)
    {
        var cursor = new Mock<IAsyncCursor<Transfer>>(MockBehavior.Strict);
        var batch = item is null ? Array.Empty<Transfer>() : new[] { item };

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

    private static string CreateOperationResultJson(bool success, string? error)
    {
        return JsonSerializer.Serialize(new
        {
            Success = success,
            Error = error
        });
    }

    private static bool IsCancelInitiatedAuditEvent(
        AuditEventRequest request,
        string transferId,
        uint userId,
        string expectedKey)
    {
        if (request.TransactionId != transferId ||
            request.EventType != AuditEventType.StatusChange ||
            request.ActorUserId != userId ||
            request.Details is null)
        {
            return false;
        }

        return request.Details.TryGetValue("action", out var action) &&
               request.Details.TryGetValue("idempotencyKey", out var key) &&
               action == "CANCEL_INITIATED" &&
               key == expectedKey;
    }

    private static bool IsDuplicateBlockedAuditEvent(
        AuditEventRequest request,
        string expectedTransactionId,
        uint expectedActorUserId)
    {
        if (request.TransactionId != expectedTransactionId ||
            request.EventType != AuditEventType.SecurityCheck ||
            request.ActorUserId != expectedActorUserId ||
            request.Details is null)
        {
            return false;
        }

        return request.Details.TryGetValue("action", out var action) &&
               request.Details.TryGetValue("idempotencyKey", out var key) &&
               action == "DUPLICATE_REQUEST_BLOCKED" &&
               key == expectedTransactionId;
    }
}
