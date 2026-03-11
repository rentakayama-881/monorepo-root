using FeatureService.Api.DTOs;
using FeatureService.Api.Infrastructure.OxaPay;
using FeatureService.Api.Models.Entities;
using FeatureService.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using MongoDB.Driver;

namespace FeatureService.Api.Tests.Services;

public class DepositServiceTests
{
    [Fact]
    public async Task CreateRequestAsync_WhenUnexpiredPendingDepositExists_ReusesExistingDeposit()
    {
        var deposit = CreateDeposit(status: DepositStatus.WaitingPayment);
        deposit.ExpiredAt = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds();

        var depositsCollection = CreateDepositsCollectionMock(deposit);
        var walletService = new Mock<IWalletService>(MockBehavior.Strict);
        var oxaPayService = new Mock<IOxaPayService>(MockBehavior.Strict);
        var logger = new Mock<ILogger<DepositService>>(MockBehavior.Loose);

        var sut = CreateSut(
            depositsCollection.Object,
            walletService.Object,
            oxaPayService.Object,
            logger.Object);

        var result = await sut.CreateRequestAsync(
            deposit.UserId,
            deposit.Username,
            new CreateDepositRequest { Amount = deposit.Amount });

        result.DepositId.Should().Be(deposit.Id);
        result.TrackId.Should().Be(deposit.TrackId);
        result.PayAmount.Should().Be(deposit.PayAmount);
        result.PayCurrency.Should().Be(deposit.PayCurrency);
        result.Address.Should().Be(deposit.Address);

        depositsCollection.Verify(c => c.InsertOneAsync(
                It.IsAny<DepositRequest>(),
                It.IsAny<InsertOneOptions>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
        oxaPayService.VerifyNoOtherCalls();
        walletService.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task CancelDepositAsync_WhenWaitingPayment_CancelsDepositWithoutWalletChange()
    {
        var deposit = CreateDeposit(status: DepositStatus.WaitingPayment);

        var depositsCollection = CreateDepositsCollectionMock(deposit, updateModifiedCount: 1);
        var walletService = new Mock<IWalletService>(MockBehavior.Strict);
        var oxaPayService = new Mock<IOxaPayService>(MockBehavior.Strict);
        var logger = new Mock<ILogger<DepositService>>(MockBehavior.Loose);

        var sut = CreateSut(
            depositsCollection.Object,
            walletService.Object,
            oxaPayService.Object,
            logger.Object);

        var (success, error) = await sut.CancelDepositAsync(deposit.Id, deposit.UserId);

        success.Should().BeTrue();
        error.Should().BeNull();

        depositsCollection.Verify(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<DepositRequest>>(),
                It.IsAny<UpdateDefinition<DepositRequest>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
        walletService.VerifyNoOtherCalls();
        oxaPayService.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task HandleCallbackAsync_WhenPaymentPaid_CreditsWalletAndStoresTransactionId()
    {
        var deposit = CreateDeposit(status: DepositStatus.WaitingPayment);

        var depositsCollection = CreateDepositsCollectionMock(deposit, updateModifiedCount: 1);
        var walletService = new Mock<IWalletService>(MockBehavior.Strict);
        var oxaPayService = new Mock<IOxaPayService>(MockBehavior.Strict);
        var logger = new Mock<ILogger<DepositService>>(MockBehavior.Loose);

        walletService
            .Setup(s => s.AddBalanceAsync(
                deposit.UserId,
                deposit.Amount,
                $"Deposit {deposit.PayCurrency} ({deposit.TrackId})",
                TransactionType.Deposit,
                deposit.Id,
                "deposit"))
            .ReturnsAsync("txn_deposit_001");

        var sut = CreateSut(
            depositsCollection.Object,
            walletService.Object,
            oxaPayService.Object,
            logger.Object);

        var (success, error) = await sut.HandleCallbackAsync(new OxaPayCallbackPayload
        {
            TrackId = deposit.TrackId,
            Status = "paid"
        });

        success.Should().BeTrue();
        error.Should().BeNull();

        walletService.Verify(s => s.AddBalanceAsync(
            deposit.UserId,
            deposit.Amount,
            $"Deposit {deposit.PayCurrency} ({deposit.TrackId})",
            TransactionType.Deposit,
            deposit.Id,
            "deposit"), Times.Once);
        depositsCollection.Verify(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<DepositRequest>>(),
                It.IsAny<UpdateDefinition<DepositRequest>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()),
            Times.Exactly(2));
        oxaPayService.VerifyNoOtherCalls();
    }

    private static DepositService CreateSut(
        IMongoCollection<DepositRequest> deposits,
        IWalletService walletService,
        IOxaPayService oxaPayService,
        ILogger<DepositService> logger)
    {
        return new DepositService(
            deposits,
            walletService,
            oxaPayService,
            new OxaPaySettings
            {
                CallbackBaseUrl = "https://feature.aivalid.id",
                DefaultPayCurrency = "USDT",
                DefaultNetwork = "TRC20",
                PaymentLifetimeMinutes = 60,
                UnderPaidCoverage = 2.0m
            },
            logger);
    }

    private static DepositRequest CreateDeposit(DepositStatus status)
    {
        var now = DateTime.UtcNow;
        return new DepositRequest
        {
            Id = "507f1f77bcf86cd799439011",
            UserId = 42,
            Username = "demo",
            Amount = 100_000,
            PlatformFee = 5_264,
            TrackId = "track_pending_001",
            PayCurrency = "USDT",
            PayAmount = "6.25",
            Network = "TRC20",
            Address = "TQ9w7Tn4P3pK8sD2xR6m",
            QrCode = "https://example.com/qr.png",
            Rate = "0.0000625",
            ExpiredAt = DateTimeOffset.UtcNow.AddMinutes(30).ToUnixTimeSeconds(),
            Status = status,
            OxaPayStatus = "Waiting",
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static Mock<IMongoCollection<DepositRequest>> CreateDepositsCollectionMock(
        DepositRequest? findResult,
        long updateModifiedCount = 0)
    {
        var collection = new Mock<IMongoCollection<DepositRequest>>(MockBehavior.Loose);
        var cursor = CreateCursor(findResult is null
            ? Array.Empty<DepositRequest>()
            : new[] { findResult });

        collection
            .Setup(c => c.FindAsync(
                It.IsAny<FilterDefinition<DepositRequest>>(),
                It.IsAny<FindOptions<DepositRequest, DepositRequest>>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(cursor.Object);

        collection
            .Setup(c => c.FindSync(
                It.IsAny<FilterDefinition<DepositRequest>>(),
                It.IsAny<FindOptions<DepositRequest, DepositRequest>>(),
                It.IsAny<CancellationToken>()))
            .Returns(cursor.Object);

        collection
            .Setup(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<DepositRequest>>(),
                It.IsAny<UpdateDefinition<DepositRequest>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UpdateResult.Acknowledged(1, updateModifiedCount, null));

        collection
            .Setup(c => c.InsertOneAsync(
                It.IsAny<DepositRequest>(),
                It.IsAny<InsertOneOptions>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

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
