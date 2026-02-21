using FeatureService.Api.DTOs;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using MongoDB.Driver;

namespace FeatureService.Api.Tests.Services;

public class TransferServiceConflictRollbackTests
{
    [Fact]
    public async Task ReleaseTransferAsync_WhenReceiverCreditFails_RollsBackStatusAndReturnsUserFriendlyError()
    {
        var transfer = CreatePendingTransfer(
            id: "trf_release_rollback",
            senderId: 100,
            receiverId: 200,
            holdUntil: DateTime.UtcNow.AddHours(4));

        var transfers = new Mock<IMongoCollection<Transfer>>(MockBehavior.Strict);
        var walletService = new Mock<IWalletService>(MockBehavior.Strict);

        SetupFindSequence(transfers, transfer);
        SetupUpdateSequence(transfers, modifiedCounts: new long[] { 1, 1 });

        walletService
            .Setup(s => s.VerifyPinAsync(transfer.SenderId, "123456"))
            .ReturnsAsync(new VerifyPinResponse(true, "PIN valid", 4));

        walletService
            .Setup(s => s.AddBalanceAsync(
                transfer.ReceiverId,
                98_000,
                $"Transfer dari @{transfer.SenderUsername}",
                TransactionType.TransferIn,
                transfer.Id,
                "transfer"))
            .ThrowsAsync(new InvalidOperationException("credit failed"));

        var sut = CreateSut(transfers.Object, walletService.Object);

        var (success, error) = await sut.ReleaseTransferAsync(transfer.Id, transfer.SenderId, "123456");

        Assert.False(success);
        Assert.Equal("Gagal melepaskan dana. Silakan coba lagi atau hubungi support.", error);

        transfers.Verify(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<Transfer>>(),
                It.IsAny<UpdateDefinition<Transfer>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()),
            Times.Exactly(2));
        walletService.VerifyAll();
    }

    [Fact]
    public async Task CancelTransferAsync_WhenSenderRefundFails_RollsBackStatusAndReturnsUserFriendlyError()
    {
        var transfer = CreatePendingTransfer(
            id: "trf_cancel_rollback",
            senderId: 101,
            receiverId: 201,
            holdUntil: DateTime.UtcNow.AddHours(5));

        var transfers = new Mock<IMongoCollection<Transfer>>(MockBehavior.Strict);
        var walletService = new Mock<IWalletService>(MockBehavior.Strict);

        SetupFindSequence(transfers, transfer);
        SetupUpdateSequence(transfers, modifiedCounts: new long[] { 1, 1 });

        walletService
            .Setup(s => s.VerifyPinAsync(transfer.SenderId, "123456"))
            .ReturnsAsync(new VerifyPinResponse(true, "PIN valid", 4));

        walletService
            .Setup(s => s.AddBalanceAsync(
                transfer.SenderId,
                transfer.Amount,
                $"Pembatalan transfer ke @{transfer.ReceiverUsername}",
                TransactionType.Refund,
                transfer.Id,
                "transfer"))
            .ThrowsAsync(new InvalidOperationException("refund failed"));

        var sut = CreateSut(transfers.Object, walletService.Object);

        var (success, error) = await sut.CancelTransferAsync(
            transfer.Id,
            transfer.SenderId,
            "123456",
            "test rollback");

        Assert.False(success);
        Assert.Equal("Gagal mengembalikan dana. Silakan coba lagi atau hubungi support.", error);

        transfers.Verify(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<Transfer>>(),
                It.IsAny<UpdateDefinition<Transfer>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()),
            Times.Exactly(2));
        walletService.VerifyAll();
    }

    [Fact]
    public async Task ReleaseTransferAsync_WhenConcurrentStatusUpdateOccurs_ReturnsConflictMessageFromLatestState()
    {
        var pendingTransfer = CreatePendingTransfer(
            id: "trf_release_conflict",
            senderId: 102,
            receiverId: 202,
            holdUntil: DateTime.UtcNow.AddHours(2));

        var latestTransfer = CreatePendingTransfer(
            id: pendingTransfer.Id,
            senderId: pendingTransfer.SenderId,
            receiverId: pendingTransfer.ReceiverId,
            holdUntil: pendingTransfer.HoldUntil);
        latestTransfer.Status = TransferStatus.Released;

        var transfers = new Mock<IMongoCollection<Transfer>>(MockBehavior.Strict);
        var walletService = new Mock<IWalletService>(MockBehavior.Strict);

        SetupFindSequence(transfers, pendingTransfer, latestTransfer);
        SetupUpdateSequence(transfers, modifiedCounts: new long[] { 0 });

        walletService
            .Setup(s => s.VerifyPinAsync(pendingTransfer.SenderId, "123456"))
            .ReturnsAsync(new VerifyPinResponse(true, "PIN valid", 4));

        var sut = CreateSut(transfers.Object, walletService.Object);

        var (success, error) = await sut.ReleaseTransferAsync(
            pendingTransfer.Id,
            pendingTransfer.SenderId,
            "123456");

        Assert.False(success);
        Assert.Equal("Transfer sudah Released", error);

        walletService.Verify(s => s.AddBalanceAsync(
            It.IsAny<uint>(),
            It.IsAny<long>(),
            It.IsAny<string>(),
            It.IsAny<TransactionType>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
        walletService.VerifyAll();
    }

    private static TransferService CreateSut(
        IMongoCollection<Transfer> transfers,
        IWalletService walletService)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var logger = new Mock<ILogger<TransferService>>(MockBehavior.Loose);

        return new TransferService(
            transfers,
            walletService,
            new HttpClient(),
            configuration,
            logger.Object);
    }

    private static Transfer CreatePendingTransfer(
        string id,
        uint senderId,
        uint receiverId,
        DateTime? holdUntil)
    {
        return new Transfer
        {
            Id = id,
            Code = "12345678",
            SenderId = senderId,
            SenderUsername = $"sender_{senderId}",
            ReceiverId = receiverId,
            ReceiverUsername = $"receiver_{receiverId}",
            Amount = 100_000,
            Status = TransferStatus.Pending,
            HoldUntil = holdUntil,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
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

    private static void SetupUpdateSequence(
        Mock<IMongoCollection<Transfer>> collection,
        long[] modifiedCounts)
    {
        var setup = collection.SetupSequence(c => c.UpdateOneAsync(
            It.IsAny<FilterDefinition<Transfer>>(),
            It.IsAny<UpdateDefinition<Transfer>>(),
            It.IsAny<UpdateOptions>(),
            It.IsAny<CancellationToken>()));

        foreach (var modifiedCount in modifiedCounts)
        {
            setup = setup.ReturnsAsync(new UpdateResult.Acknowledged(
                matchedCount: 1,
                modifiedCount: modifiedCount,
                upsertedId: null));
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
}
