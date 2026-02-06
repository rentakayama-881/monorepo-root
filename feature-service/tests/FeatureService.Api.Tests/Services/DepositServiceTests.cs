using FeatureService.Api.Models.Entities;
using FeatureService.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FeatureService.Api.Tests.Services;

public class DepositServiceTests
{
    [Fact]
    public async Task ApproveAsync_WhenPendingDeposit_CreditsWalletAndPersistsApproval()
    {
        var deposit = new DepositRequest
        {
            Id = "507f1f77bcf86cd799439011",
            UserId = 42,
            Username = "demo",
            Amount = 100_000,
            Method = "QRIS",
            ExternalTransactionId = "TRX-APPROVE-001",
            Status = DepositStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var depositsCollection = CreateDepositsCollectionMock(deposit, updateModifiedCount: 1);
        var depositsRawCollection = new Mock<IMongoCollection<BsonDocument>>(MockBehavior.Loose);
        var walletService = new Mock<IWalletService>(MockBehavior.Strict);
        var logger = new Mock<ILogger<DepositService>>(MockBehavior.Loose);

        walletService
            .Setup(s => s.AddBalanceAsync(
                deposit.UserId,
                deposit.Amount,
                $"Deposit {deposit.Method} ({deposit.ExternalTransactionId})",
                TransactionType.Deposit,
                deposit.Id,
                "deposit"))
            .ReturnsAsync("txn_approved_001");

        var sut = new DepositService(
            depositsCollection.Object,
            depositsRawCollection.Object,
            walletService.Object,
            logger.Object);

        var (success, error) = await sut.ApproveAsync(
            $"  {deposit.Id}  ",
            adminId: 7,
            adminUsername: "admin.fin",
            amountOverride: null);

        success.Should().BeTrue();
        error.Should().BeNull();

        walletService.Verify(s => s.AddBalanceAsync(
            deposit.UserId,
            deposit.Amount,
            $"Deposit {deposit.Method} ({deposit.ExternalTransactionId})",
            TransactionType.Deposit,
            deposit.Id,
            "deposit"), Times.Once);

        depositsCollection.Verify(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<DepositRequest>>(),
                It.IsAny<UpdateDefinition<DepositRequest>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }

    [Fact]
    public async Task RejectAsync_WhenReasonIsWhitespace_ReturnsValidationErrorWithoutDbWrite()
    {
        var depositsCollection = new Mock<IMongoCollection<DepositRequest>>(MockBehavior.Strict);
        var depositsRawCollection = new Mock<IMongoCollection<BsonDocument>>(MockBehavior.Loose);
        var walletService = new Mock<IWalletService>(MockBehavior.Strict);
        var logger = new Mock<ILogger<DepositService>>(MockBehavior.Loose);

        var sut = new DepositService(
            depositsCollection.Object,
            depositsRawCollection.Object,
            walletService.Object,
            logger.Object);

        var (success, error) = await sut.RejectAsync(
            "507f1f77bcf86cd799439012",
            adminId: 8,
            adminUsername: "admin.fin",
            reason: "   ");

        success.Should().BeFalse();
        error.Should().Be("Alasan penolakan harus 3-200 karakter");

        depositsCollection.Verify(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<DepositRequest>>(),
                It.IsAny<UpdateDefinition<DepositRequest>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
        walletService.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task RejectAsync_WhenReasonTooLong_ReturnsValidationErrorWithoutDbWrite()
    {
        var depositsCollection = new Mock<IMongoCollection<DepositRequest>>(MockBehavior.Strict);
        var depositsRawCollection = new Mock<IMongoCollection<BsonDocument>>(MockBehavior.Loose);
        var walletService = new Mock<IWalletService>(MockBehavior.Strict);
        var logger = new Mock<ILogger<DepositService>>(MockBehavior.Loose);

        var sut = new DepositService(
            depositsCollection.Object,
            depositsRawCollection.Object,
            walletService.Object,
            logger.Object);

        var (success, error) = await sut.RejectAsync(
            "507f1f77bcf86cd799439012",
            adminId: 8,
            adminUsername: "admin.fin",
            reason: new string('x', 201));

        success.Should().BeFalse();
        error.Should().Be("Alasan penolakan harus 3-200 karakter");

        depositsCollection.Verify(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<DepositRequest>>(),
                It.IsAny<UpdateDefinition<DepositRequest>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
        walletService.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task RejectAsync_WhenPendingDeposit_DoesNotCreditWallet()
    {
        var deposit = new DepositRequest
        {
            Id = "507f1f77bcf86cd799439013",
            UserId = 100,
            Username = "demo2",
            Amount = 200_000,
            Method = "QRIS",
            ExternalTransactionId = "TRX-REJECT-001",
            Status = DepositStatus.Pending,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var depositsCollection = CreateDepositsCollectionMock(deposit, updateModifiedCount: 1);
        var depositsRawCollection = new Mock<IMongoCollection<BsonDocument>>(MockBehavior.Loose);
        var walletService = new Mock<IWalletService>(MockBehavior.Strict);
        var logger = new Mock<ILogger<DepositService>>(MockBehavior.Loose);

        var sut = new DepositService(
            depositsCollection.Object,
            depositsRawCollection.Object,
            walletService.Object,
            logger.Object);

        var (success, error) = await sut.RejectAsync(
            deposit.Id,
            adminId: 9,
            adminUsername: "admin.fin",
            reason: "  Bukti pembayaran tidak valid  ");

        success.Should().BeTrue();
        error.Should().BeNull();

        walletService.VerifyNoOtherCalls();
        depositsCollection.Verify(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<DepositRequest>>(),
                It.IsAny<UpdateDefinition<DepositRequest>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private static Mock<IMongoCollection<DepositRequest>> CreateDepositsCollectionMock(
        DepositRequest? findResult,
        long updateModifiedCount)
    {
        var collection = new Mock<IMongoCollection<DepositRequest>>(MockBehavior.Loose);
        var findFluent = new Mock<IFindFluent<DepositRequest, DepositRequest>>(MockBehavior.Loose);
        var cursor = CreateCursor(findResult is null
            ? Array.Empty<DepositRequest>()
            : new[] { findResult });

        findFluent
            .Setup(f => f.ToCursorAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(cursor.Object);
        findFluent
            .Setup(f => f.ToCursor(It.IsAny<CancellationToken>()))
            .Returns(cursor.Object);
        findFluent
            .Setup(f => f.Limit(It.IsAny<int?>()))
            .Returns(findFluent.Object);

        collection
            .Setup(c => c.Find(
                It.IsAny<FilterDefinition<DepositRequest>>(),
                It.IsAny<FindOptions<DepositRequest, DepositRequest>>()))
            .Returns(findFluent.Object);

        collection
            .Setup(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<DepositRequest>>(),
                It.IsAny<UpdateDefinition<DepositRequest>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UpdateResult.Acknowledged(1, updateModifiedCount, null));

        return collection;
    }

    private static Mock<IAsyncCursor<DepositRequest>> CreateCursor(IEnumerable<DepositRequest> items)
    {
        var cursor = new Mock<IAsyncCursor<DepositRequest>>(MockBehavior.Loose);
        var batch = items.ToList();

        cursor.SetupGet(c => c.Current).Returns(batch);
        cursor.SetupSequence(c => c.MoveNext(It.IsAny<CancellationToken>()))
            .Returns(true)
            .Returns(false);
        cursor.SetupSequence(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(true)
            .ReturnsAsync(false);

        return cursor;
    }
}
