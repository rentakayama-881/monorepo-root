namespace FeatureService.Api.Infrastructure.Security;

public static class PqcCacheKeys
{
    public static string UserHasActivePqcKey(uint userId) => $"pqc_key_exists:{userId}";
}
