using Nexis.Identity.Contracts;

namespace Nexis.Modules.Identity;

/// <summary>
/// Identity-owned in-memory view of the account/character/public-identity relationships used to
/// answer control questions for one command evaluation.
///
/// It enforces the structural invariants the Identity owner is responsible for: one playable
/// character per normal account, one account per character, and one account per public identifier.
/// The persistence boundary enforces the same invariants durably; this type exists so a rule can be
/// evaluated without reaching into storage, not as a second source of truth.
/// </summary>
public sealed class PlayerIdentityDirectory
{
    private readonly Dictionary<AccountId, PlayerIdentity> _byAccount = new();
    private readonly Dictionary<CharacterId, PlayerIdentity> _byCharacter = new();
    private readonly Dictionary<PublicPlayerId, PlayerIdentity> _byPublicPlayerId = new();

    public PlayerIdentityDirectory(IEnumerable<PlayerIdentity> identities)
    {
        ArgumentNullException.ThrowIfNull(identities);

        foreach (var identity in identities)
        {
            if (identity is null)
            {
                throw new ArgumentException("Player identity collections cannot contain null entries.", nameof(identities));
            }

            if (!_byAccount.TryAdd(identity.AccountId, identity))
            {
                throw new InvalidOperationException(
                    $"Account '{identity.AccountId}' already has a playable character. Nexis exposes one playable character per normal account.");
            }

            if (!_byCharacter.TryAdd(identity.CharacterId, identity))
            {
                throw new InvalidOperationException(
                    $"Character '{identity.CharacterId}' is already controlled by another account.");
            }

            if (!_byPublicPlayerId.TryAdd(identity.PublicPlayerId, identity))
            {
                throw new InvalidOperationException(
                    $"Public player identifier '{identity.PublicPlayerId}' is already assigned.");
            }
        }
    }

    public PlayerIdentity? FindByAccount(AccountId accountId) =>
        _byAccount.TryGetValue(accountId, out var identity) ? identity : null;

    public PlayerIdentity? FindByCharacter(CharacterId characterId) =>
        _byCharacter.TryGetValue(characterId, out var identity) ? identity : null;

    /// <summary>
    /// Public identifiers are world-readable, so this resolves only to a knowledge-safe projection.
    /// It deliberately never returns the internal identity record.
    /// </summary>
    public PublicPlayerProjection? FindPublicProjection(PublicPlayerId publicPlayerId) =>
        _byPublicPlayerId.TryGetValue(publicPlayerId, out var identity) ? identity.ToPublicProjection() : null;

    /// <summary>
    /// Answers whether the trusted acting actor controls the character behind a client-supplied
    /// public identifier.
    ///
    /// The client-supplied identifier is treated as a hostile assertion: control is decided from the
    /// server-derived actor, never from the submitted value. A forged identifier therefore yields no
    /// CharacterId at all rather than a character the actor does not control.
    /// </summary>
    public PlayerIdentityResolutionResult ResolveControlledCharacter(
        TrustedActorContext actor,
        PublicPlayerId publicPlayerId)
    {
        ArgumentNullException.ThrowIfNull(actor);

        if (!_byPublicPlayerId.TryGetValue(publicPlayerId, out var identity))
        {
            return PlayerIdentityResolutionResult.Unknown;
        }

        if (actor.AccountId is not { } accountId || actor.CharacterId is not { } characterId)
        {
            return PlayerIdentityResolutionResult.NotControlled;
        }

        return identity.AccountId == accountId && identity.CharacterId == characterId
            ? PlayerIdentityResolutionResult.Controlled(identity.CharacterId)
            : PlayerIdentityResolutionResult.NotControlled;
    }
}
