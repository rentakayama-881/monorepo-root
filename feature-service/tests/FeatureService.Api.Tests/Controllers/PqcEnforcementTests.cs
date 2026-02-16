using System.Reflection;
using FeatureService.Api.Attributes;
using FeatureService.Api.Controllers.Finance;
using Xunit;

namespace FeatureService.Api.Tests.Controllers;

public class PqcEnforcementTests
{
    [Fact]
    public void Transfers_WriteEndpoints_RequirePqcSignatureAndIdempotencyKey()
    {
        AssertRequiresPqc(typeof(TransfersController), nameof(TransfersController.CreateTransfer), requireIdempotencyKey: true);
        AssertRequiresPqc(typeof(TransfersController), nameof(TransfersController.ReleaseTransfer), requireIdempotencyKey: true);
        AssertRequiresPqc(typeof(TransfersController), nameof(TransfersController.CancelTransfer), requireIdempotencyKey: true);
        AssertRequiresPqc(typeof(TransfersController), nameof(TransfersController.RejectTransfer), requireIdempotencyKey: true);
    }

    [Fact]
    public void Withdrawals_WriteEndpoints_RequirePqcSignatureAndIdempotencyKey()
    {
        AssertRequiresPqc(typeof(WithdrawalsController), nameof(WithdrawalsController.CreateWithdrawal), requireIdempotencyKey: true);
        AssertRequiresPqc(typeof(WithdrawalsController), nameof(WithdrawalsController.CancelWithdrawal), requireIdempotencyKey: true);
    }

    [Fact]
    public void WalletPin_Endpoints_RequirePqcSignature()
    {
        AssertRequiresPqc(typeof(WalletsController), nameof(WalletsController.SetPin), requireIdempotencyKey: true);
        AssertRequiresPqc(typeof(WalletsController), nameof(WalletsController.VerifyPin), requireIdempotencyKey: false);
    }

    [Fact]
    public void Deposits_CreateRequest_RequiresPqcSignatureAndIdempotencyKey()
    {
        AssertRequiresPqc(typeof(DepositsController), nameof(DepositsController.CreateDepositRequest), requireIdempotencyKey: true);
    }

    [Fact]
    public void Disputes_WriteEndpoints_RequirePqcSignatureAndIdempotencyKey()
    {
        AssertRequiresPqc(typeof(DisputesController), nameof(DisputesController.CreateDispute), requireIdempotencyKey: true);
        AssertRequiresPqc(typeof(DisputesController), nameof(DisputesController.AddMessage), requireIdempotencyKey: true);
        AssertRequiresPqc(typeof(DisputesController), nameof(DisputesController.AddEvidence), requireIdempotencyKey: true);
        AssertRequiresPqc(typeof(DisputesController), nameof(DisputesController.CancelDispute), requireIdempotencyKey: true);
        AssertRequiresPqc(typeof(DisputesController), nameof(DisputesController.MutualRefund), requireIdempotencyKey: true);
    }

    private static void AssertRequiresPqc(Type controllerType, string actionName, bool requireIdempotencyKey)
    {
        var method = controllerType
            .GetMethods(BindingFlags.Instance | BindingFlags.Public)
            .Single(m => string.Equals(m.Name, actionName, StringComparison.Ordinal));

        var attribute = method.GetCustomAttribute<RequiresPqcSignatureAttribute>();
        Assert.NotNull(attribute);

        Assert.Equal(requireIdempotencyKey, attribute!.RequireIdempotencyKey);
    }
}

