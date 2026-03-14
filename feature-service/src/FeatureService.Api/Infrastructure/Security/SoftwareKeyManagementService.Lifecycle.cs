using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace FeatureService.Api.Infrastructure.Security;

public partial class SoftwareKeyManagementService
{
    /// <inheritdoc/>
    public Task<KeyMetadata> GetKeyMetadataAsync(
        string keyId,
        CancellationToken cancellationToken = default)
    {
        if (!_keyStore.TryGetValue(keyId, out var wrappedKey))
        {
            throw new KeyNotFoundException($"Key '{keyId}' not found");
        }

        return Task.FromResult(wrappedKey.Metadata);
    }

    /// <inheritdoc/>
    public Task<IReadOnlyList<KeyMetadata>> ListKeysAsync(
        string? purposeFilter = null,
        CancellationToken cancellationToken = default)
    {
        var keys = _keyStore.Values
            .Select(k => k.Metadata)
            .Where(m => purposeFilter == null || m.Purpose == purposeFilter)
            .ToList();

        return Task.FromResult<IReadOnlyList<KeyMetadata>>(keys);
    }

    /// <inheritdoc/>
    public Task ScheduleKeyDeletionAsync(
        string keyId,
        TimeSpan? gracePeriod = null,
        CancellationToken cancellationToken = default)
    {
        if (!_keyStore.TryGetValue(keyId, out var wrappedKey))
        {
            throw new KeyNotFoundException($"Key '{keyId}' not found");
        }

        // Update state to pending deletion
        var updatedMetadata = wrappedKey.Metadata with { State = KeyState.PendingDeletion };
        _keyStore[keyId] = new WrappedKey(wrappedKey.WrappedKeyMaterial, updatedMetadata, wrappedKey.PublicKey);

        _logger.LogWarning("Key '{KeyId}' scheduled for deletion", keyId);

        return Task.CompletedTask;
    }

    /// <inheritdoc/>
    public Task CancelKeyDeletionAsync(
        string keyId,
        CancellationToken cancellationToken = default)
    {
        if (!_keyStore.TryGetValue(keyId, out var wrappedKey))
        {
            throw new KeyNotFoundException($"Key '{keyId}' not found");
        }

        if (wrappedKey.Metadata.State != KeyState.PendingDeletion)
        {
            throw new InvalidOperationException($"Key '{keyId}' is not pending deletion");
        }

        var updatedMetadata = wrappedKey.Metadata with { State = KeyState.Enabled };
        _keyStore[keyId] = new WrappedKey(wrappedKey.WrappedKeyMaterial, updatedMetadata, wrappedKey.PublicKey);

        _logger.LogInformation("Key deletion cancelled for '{KeyId}'", keyId);

        return Task.CompletedTask;
    }

    /// <inheritdoc/>
    public Task<KeyMetadata> RotateKeyAsync(
        string keyId,
        CancellationToken cancellationToken = default)
    {
        if (!_keyStore.TryGetValue(keyId, out var wrappedKey))
        {
            throw new KeyNotFoundException($"Key '{keyId}' not found");
        }

        // Generate new key material
        var oldKeyMaterial = UnwrapKeyMaterial(wrappedKey.WrappedKeyMaterial, keyId);
        var newKeyMaterial = RandomNumberGenerator.GetBytes(oldKeyMaterial.Length);

        try
        {
            var newWrapped = WrapKeyMaterial(newKeyMaterial, keyId);

            var updatedMetadata = wrappedKey.Metadata with
            {
                Version = wrappedKey.Metadata.Version + 1,
                RotatedAt = DateTime.UtcNow
            };

            _keyStore[keyId] = new WrappedKey(newWrapped, updatedMetadata, wrappedKey.PublicKey);

            _logger.LogInformation("Key '{KeyId}' rotated to version {Version}", keyId, updatedMetadata.Version);

            return Task.FromResult(updatedMetadata);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(oldKeyMaterial);
            CryptographicOperations.ZeroMemory(newKeyMaterial);
        }
    }
}
