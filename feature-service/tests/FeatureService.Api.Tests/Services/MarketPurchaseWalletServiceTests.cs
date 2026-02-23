using FeatureService.Api.Models.Entities;
using FeatureService.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;

namespace FeatureService.Api.Tests.Services;

public class MarketPurchaseWalletServiceTests
{
    [Fact]
    public async Task ReleaseAsync_WhenConcurrentCallsForSameReservation_CreditsWalletOnce()
    {
        var initial = CreateReservedReservation();
        var store = new ReservationCollectionStore(initial);
        var walletService = new Mock<IWalletService>(MockBehavior.Strict);
        var logger = new Mock<ILogger<MarketPurchaseWalletService>>(MockBehavior.Loose);
        var creditStarted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);

        walletService
            .Setup(s => s.AddBalanceAsync(
                initial.UserId,
                initial.AmountIdr,
                "manual release",
                TransactionType.MarketPurchaseRelease,
                initial.OrderId,
                "market_chatgpt"))
            .Returns(async () =>
            {
                creditStarted.TrySetResult(true);
                await Task.Delay(100);
                return "txn_release_001";
            });

        var sut = new MarketPurchaseWalletService(
            store.Collection.Object,
            walletService.Object,
            logger.Object);

        var firstRelease = sut.ReleaseAsync(initial.UserId, initial.OrderId, "manual release");
        await creditStarted.Task;
        var secondRelease = sut.ReleaseAsync(initial.UserId, initial.OrderId, "manual release");

        var results = await Task.WhenAll(firstRelease, secondRelease);

        results.Count(r => r.success).Should().Be(1);
        results.Count(r => !r.success).Should().Be(1);
        results.Count(r => r.error == "Reservasi tidak bisa direlease").Should().Be(1);
        walletService.Verify(s => s.AddBalanceAsync(
            initial.UserId,
            initial.AmountIdr,
            "manual release",
            TransactionType.MarketPurchaseRelease,
            initial.OrderId,
            "market_chatgpt"), Times.Once);

        var latest = store.Snapshot();
        latest.Should().NotBeNull();
        latest!.Status.Should().Be(ReservationStatus.Released);
        latest.ReleaseTransactionId.Should().Be("txn_release_001");
    }

    [Fact]
    public async Task ReleaseAsync_WhenCalledTwiceSequentially_CreditsOnlyOnce()
    {
        var initial = CreateReservedReservation();
        var store = new ReservationCollectionStore(initial);
        var walletService = new Mock<IWalletService>(MockBehavior.Strict);
        var logger = new Mock<ILogger<MarketPurchaseWalletService>>(MockBehavior.Loose);

        walletService
            .Setup(s => s.AddBalanceAsync(
                initial.UserId,
                initial.AmountIdr,
                "release once",
                TransactionType.MarketPurchaseRelease,
                initial.OrderId,
                "market_chatgpt"))
            .ReturnsAsync("txn_release_002");

        var sut = new MarketPurchaseWalletService(
            store.Collection.Object,
            walletService.Object,
            logger.Object);

        var first = await sut.ReleaseAsync(initial.UserId, initial.OrderId, "release once");
        var second = await sut.ReleaseAsync(initial.UserId, initial.OrderId, "release once");

        first.success.Should().BeTrue();
        second.success.Should().BeFalse();
        second.error.Should().Be("Reservasi sudah dilepas");

        walletService.Verify(s => s.AddBalanceAsync(
            initial.UserId,
            initial.AmountIdr,
            "release once",
            TransactionType.MarketPurchaseRelease,
            initial.OrderId,
            "market_chatgpt"), Times.Once);
    }

    [Fact]
    public async Task ReleaseAsync_WhenClaimReservedCasFails_DoesNotCreditWallet()
    {
        var reserved = CreateReservedReservation();
        var released = CloneReservation(reserved);
        released.Status = ReservationStatus.Released;
        released.ReleasedAt = DateTime.UtcNow;
        released.ReleaseTransactionId = "txn_existing";
        released.UpdatedAt = DateTime.UtcNow;

        var collection = new Mock<IMongoCollection<MarketPurchaseReservation>>(MockBehavior.Strict);
        var walletService = new Mock<IWalletService>(MockBehavior.Strict);
        var logger = new Mock<ILogger<MarketPurchaseWalletService>>(MockBehavior.Loose);

        SetupFindSequence(collection, reserved, released);
        collection
            .Setup(c => c.UpdateOneAsync(
                It.IsAny<FilterDefinition<MarketPurchaseReservation>>(),
                It.IsAny<UpdateDefinition<MarketPurchaseReservation>>(),
                It.IsAny<UpdateOptions>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UpdateResult.Acknowledged(
                matchedCount: 1,
                modifiedCount: 0,
                upsertedId: null));

        var sut = new MarketPurchaseWalletService(
            collection.Object,
            walletService.Object,
            logger.Object);

        var result = await sut.ReleaseAsync(reserved.UserId, reserved.OrderId, "release");

        result.success.Should().BeFalse();
        result.error.Should().Be("Reservasi sudah dilepas");
        walletService.Verify(s => s.AddBalanceAsync(
            It.IsAny<uint>(),
            It.IsAny<long>(),
            It.IsAny<string>(),
            It.IsAny<TransactionType>(),
            It.IsAny<string?>(),
            It.IsAny<string?>()), Times.Never);
    }

    private static MarketPurchaseReservation CreateReservedReservation()
    {
        var now = DateTime.UtcNow;
        return new MarketPurchaseReservation
        {
            Id = "mpr_test_001",
            OrderId = "order-cas-001",
            UserId = 42,
            AmountIdr = 150_000,
            Status = ReservationStatus.Reserved,
            ReserveTransactionId = "txn_reserve_001",
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    private static void SetupFindSequence(
        Mock<IMongoCollection<MarketPurchaseReservation>> collection,
        params MarketPurchaseReservation?[] results)
    {
        var asyncSetup = collection.SetupSequence(c => c.FindAsync(
            It.IsAny<FilterDefinition<MarketPurchaseReservation>>(),
            It.IsAny<FindOptions<MarketPurchaseReservation, MarketPurchaseReservation>>(),
            It.IsAny<CancellationToken>()));

        var syncSetup = collection.SetupSequence(c => c.FindSync(
            It.IsAny<FilterDefinition<MarketPurchaseReservation>>(),
            It.IsAny<FindOptions<MarketPurchaseReservation, MarketPurchaseReservation>>(),
            It.IsAny<CancellationToken>()));

        foreach (var result in results)
        {
            var cursor = CreateCursor(result is null
                ? Array.Empty<MarketPurchaseReservation>()
                : new[] { result });
            asyncSetup = asyncSetup.ReturnsAsync(cursor.Object);
            syncSetup = syncSetup.Returns(cursor.Object);
        }
    }

    private sealed class ReservationCollectionStore
    {
        private static readonly IBsonSerializerRegistry SerializerRegistry = BsonSerializer.SerializerRegistry;
        private static readonly IBsonSerializer<MarketPurchaseReservation> ReservationSerializer =
            SerializerRegistry.GetSerializer<MarketPurchaseReservation>();

        private readonly object _gate = new();
        private MarketPurchaseReservation? _current;

        public ReservationCollectionStore(MarketPurchaseReservation initial)
        {
            _current = CloneReservation(initial);
            Collection = BuildCollectionMock();
        }

        public Mock<IMongoCollection<MarketPurchaseReservation>> Collection { get; }

        public MarketPurchaseReservation? Snapshot()
        {
            lock (_gate)
            {
                return _current == null ? null : CloneReservation(_current);
            }
        }

        private Mock<IMongoCollection<MarketPurchaseReservation>> BuildCollectionMock()
        {
            var collection = new Mock<IMongoCollection<MarketPurchaseReservation>>(MockBehavior.Strict);

            collection
                .Setup(c => c.FindAsync(
                    It.IsAny<FilterDefinition<MarketPurchaseReservation>>(),
                    It.IsAny<FindOptions<MarketPurchaseReservation, MarketPurchaseReservation>>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync((FilterDefinition<MarketPurchaseReservation> filter, FindOptions<MarketPurchaseReservation, MarketPurchaseReservation>? options, CancellationToken cancellationToken) =>
                {
                    var items = ReadMatching(filter);
                    return CreateCursor(items).Object;
                });

            collection
                .Setup(c => c.FindSync(
                    It.IsAny<FilterDefinition<MarketPurchaseReservation>>(),
                    It.IsAny<FindOptions<MarketPurchaseReservation, MarketPurchaseReservation>>(),
                    It.IsAny<CancellationToken>()))
                .Returns((FilterDefinition<MarketPurchaseReservation> filter, FindOptions<MarketPurchaseReservation, MarketPurchaseReservation>? options, CancellationToken cancellationToken) =>
                {
                    var items = ReadMatching(filter);
                    return CreateCursor(items).Object;
                });

            collection
                .Setup(c => c.UpdateOneAsync(
                    It.IsAny<FilterDefinition<MarketPurchaseReservation>>(),
                    It.IsAny<UpdateDefinition<MarketPurchaseReservation>>(),
                    It.IsAny<UpdateOptions>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync((FilterDefinition<MarketPurchaseReservation> filter, UpdateDefinition<MarketPurchaseReservation> update, UpdateOptions? options, CancellationToken cancellationToken) =>
                    ApplyUpdate(filter, update));

            return collection;
        }

        private IReadOnlyList<MarketPurchaseReservation> ReadMatching(FilterDefinition<MarketPurchaseReservation> filter)
        {
            lock (_gate)
            {
                if (_current == null || !FilterMatches(_current, filter))
                {
                    return Array.Empty<MarketPurchaseReservation>();
                }

                return new[] { CloneReservation(_current) };
            }
        }

        private UpdateResult ApplyUpdate(
            FilterDefinition<MarketPurchaseReservation> filter,
            UpdateDefinition<MarketPurchaseReservation> update)
        {
            lock (_gate)
            {
                if (_current == null || !FilterMatches(_current, filter))
                {
                    return new UpdateResult.Acknowledged(
                        matchedCount: 0,
                        modifiedCount: 0,
                        upsertedId: null);
                }

                var renderedUpdate = update.Render(ReservationSerializer, SerializerRegistry).AsBsonDocument;
                ApplySetOperations(renderedUpdate, _current);

                return new UpdateResult.Acknowledged(
                    matchedCount: 1,
                    modifiedCount: 1,
                    upsertedId: null);
            }
        }

        private static void ApplySetOperations(BsonDocument renderedUpdate, MarketPurchaseReservation reservation)
        {
            if (!renderedUpdate.TryGetValue("$set", out var setValue) || !setValue.IsBsonDocument)
            {
                return;
            }

            foreach (var element in setValue.AsBsonDocument.Elements)
            {
                switch (element.Name)
                {
                    case "status":
                        reservation.Status = element.Value.AsString;
                        break;
                    case "reason":
                        reservation.Reason = element.Value.IsBsonNull ? null : element.Value.AsString;
                        break;
                    case "releaseTransactionId":
                        reservation.ReleaseTransactionId = element.Value.IsBsonNull ? null : element.Value.AsString;
                        break;
                    case "updatedAt":
                        reservation.UpdatedAt = element.Value.ToUniversalTime();
                        break;
                    case "releasedAt":
                        reservation.ReleasedAt = element.Value.IsBsonNull ? null : element.Value.ToUniversalTime();
                        break;
                }
            }
        }

        private static bool FilterMatches(
            MarketPurchaseReservation reservation,
            FilterDefinition<MarketPurchaseReservation> filter)
        {
            var renderedFilter = filter.Render(ReservationSerializer, SerializerRegistry);
            return MatchDocument(renderedFilter, reservation);
        }

        private static bool MatchDocument(BsonDocument filter, MarketPurchaseReservation reservation)
        {
            foreach (var element in filter.Elements)
            {
                if (element.Name == "$and")
                {
                    foreach (var entry in element.Value.AsBsonArray)
                    {
                        if (!MatchDocument(entry.AsBsonDocument, reservation))
                        {
                            return false;
                        }
                    }

                    continue;
                }

                switch (element.Name)
                {
                    case "orderId":
                        if (!MatchString(reservation.OrderId, element.Value))
                        {
                            return false;
                        }

                        break;
                    case "userId":
                        if (!MatchUnsignedInt(reservation.UserId, element.Value))
                        {
                            return false;
                        }

                        break;
                    case "status":
                        if (!MatchString(reservation.Status, element.Value))
                        {
                            return false;
                        }

                        break;
                }
            }

            return true;
        }

        private static bool MatchUnsignedInt(uint actual, BsonValue expected)
        {
            if (expected.IsInt32)
            {
                return actual == (uint)expected.AsInt32;
            }

            if (expected.IsInt64)
            {
                return actual == (uint)expected.AsInt64;
            }

            if (expected.IsBsonDocument && expected.AsBsonDocument.TryGetValue("$eq", out var eqValue))
            {
                return MatchUnsignedInt(actual, eqValue);
            }

            return true;
        }

        private static bool MatchString(string actual, BsonValue expected)
        {
            if (expected.IsString)
            {
                return string.Equals(actual, expected.AsString, StringComparison.Ordinal);
            }

            if (expected.IsBsonDocument && expected.AsBsonDocument.TryGetValue("$eq", out var eqValue))
            {
                return MatchString(actual, eqValue);
            }

            return true;
        }
    }

    private static MarketPurchaseReservation CloneReservation(MarketPurchaseReservation source)
    {
        return new MarketPurchaseReservation
        {
            Id = source.Id,
            OrderId = source.OrderId,
            UserId = source.UserId,
            AmountIdr = source.AmountIdr,
            Status = source.Status,
            ReserveTransactionId = source.ReserveTransactionId,
            ReleaseTransactionId = source.ReleaseTransactionId,
            Reason = source.Reason,
            CreatedAt = source.CreatedAt,
            UpdatedAt = source.UpdatedAt,
            CapturedAt = source.CapturedAt,
            ReleasedAt = source.ReleasedAt
        };
    }

    private static Mock<IAsyncCursor<MarketPurchaseReservation>> CreateCursor(IEnumerable<MarketPurchaseReservation> items)
    {
        var cursor = new Mock<IAsyncCursor<MarketPurchaseReservation>>(MockBehavior.Strict);
        var batch = items.ToList();

        cursor.SetupGet(c => c.Current).Returns(batch);
        if (batch.Count == 0)
        {
            cursor.SetupSequence(c => c.MoveNext(It.IsAny<CancellationToken>()))
                .Returns(false);
            cursor.SetupSequence(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
        }
        else
        {
            cursor.SetupSequence(c => c.MoveNext(It.IsAny<CancellationToken>()))
                .Returns(true)
                .Returns(false);
            cursor.SetupSequence(c => c.MoveNextAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(true)
                .ReturnsAsync(false);
        }

        cursor.Setup(c => c.Dispose());

        return cursor;
    }
}
