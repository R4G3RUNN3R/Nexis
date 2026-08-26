using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;

namespace Nexis.Execution.Contracts;

public sealed record CommandPayloadFingerprint
{
    private const int Sha256HexLength = 64;

    private CommandPayloadFingerprint(string value) => Value = value;

    public string Value { get; }

    public static CommandPayloadFingerprint Compute(ReadOnlySpan<byte> canonicalPayload)
    {
        var hash = SHA256.HashData(canonicalPayload);
        return new CommandPayloadFingerprint(Convert.ToHexString(hash).ToLowerInvariant());
    }

    public static CommandPayloadFingerprint Parse(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        if (value.Length != Sha256HexLength || value.Any(static character => !Uri.IsHexDigit(character)))
        {
            throw new FormatException("Command payload fingerprints must be 64 hexadecimal SHA-256 characters.");
        }

        return new CommandPayloadFingerprint(value.ToLowerInvariant());
    }

    public override string ToString() => Value;
}

public sealed record CanonicalCommandPayload
{
    private CanonicalCommandPayload(string json, CommandPayloadFingerprint fingerprint)
    {
        Json = json;
        Fingerprint = fingerprint;
    }

    public string Json { get; }

    public CommandPayloadFingerprint Fingerprint { get; }

    public static CanonicalCommandPayload FromTrustedJson(string canonicalJson)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(canonicalJson);
        try
        {
            using var _ = JsonDocument.Parse(canonicalJson);
        }
        catch (JsonException exception)
        {
            throw new FormatException("Canonical command payload must be valid JSON.", exception);
        }

        return new CanonicalCommandPayload(
            canonicalJson,
            CommandPayloadFingerprint.Compute(Encoding.UTF8.GetBytes(canonicalJson)));
    }
}

/// <summary>
/// Stable actor identity bound to CommandId idempotency. Current capabilities, entitlements and
/// security/session versions are deliberately excluded because they are revalidated execution facts.
/// </summary>
public sealed record CommandActorBinding
{
    private CommandActorBinding(
        CommandExecutionLane lane,
        AccountId? accountId,
        CharacterId? characterId,
        SystemActorKey? systemActorKey)
    {
        Lane = lane;
        AccountId = accountId;
        CharacterId = characterId;
        SystemActorKey = systemActorKey;
    }

    public CommandExecutionLane Lane { get; }

    public AccountId? AccountId { get; }

    public CharacterId? CharacterId { get; }

    public SystemActorKey? SystemActorKey { get; }

    public static CommandActorBinding From(TrustedActorContext actor)
    {
        ArgumentNullException.ThrowIfNull(actor);
        return actor.Lane switch
        {
            CommandExecutionLane.Player or CommandExecutionLane.Realtime => FromPlayer(actor),
            CommandExecutionLane.Admin => FromStaff(actor),
            CommandExecutionLane.System => FromSystem(actor),
            _ => throw new ArgumentOutOfRangeException(nameof(actor), "Unknown command execution lane.")
        };
    }

    private static CommandActorBinding FromPlayer(TrustedActorContext actor)
    {
        if (actor.Kind != ActorKind.Player || !actor.AccountId.HasValue || !actor.CharacterId.HasValue || actor.SystemActorKey is not null)
        {
            throw new InvalidOperationException("Player/realtime command actors require trusted AccountId and CharacterId identity only.");
        }

        return new CommandActorBinding(actor.Lane, actor.AccountId.Value, actor.CharacterId.Value, null);
    }

    private static CommandActorBinding FromStaff(TrustedActorContext actor)
    {
        if (actor.Kind != ActorKind.Staff || !actor.AccountId.HasValue || actor.CharacterId.HasValue || actor.SystemActorKey is not null)
        {
            throw new InvalidOperationException("Admin command actors require a trusted AccountId and cannot impersonate a CharacterId or System principal.");
        }

        return new CommandActorBinding(actor.Lane, actor.AccountId.Value, null, null);
    }

    private static CommandActorBinding FromSystem(TrustedActorContext actor)
    {
        if (actor.Kind != ActorKind.System || actor.AccountId.HasValue || actor.CharacterId.HasValue || actor.SystemActorKey is null)
        {
            throw new InvalidOperationException("System command actors require a trusted SystemActorKey and cannot carry account or character identity.");
        }

        return new CommandActorBinding(actor.Lane, null, null, actor.SystemActorKey);
    }
}

public sealed record CommandExecutionIdentity
{
    public CommandExecutionIdentity(
        CommandId commandId,
        CommandActorBinding actor,
        ContractDescriptor intentContract,
        CommandPayloadFingerprint payloadFingerprint)
    {
        if (commandId.IsEmpty)
        {
            throw new ArgumentException("CommandId cannot be empty.", nameof(commandId));
        }

        CommandId = commandId;
        Actor = actor ?? throw new ArgumentNullException(nameof(actor));
        IntentContract = intentContract ?? throw new ArgumentNullException(nameof(intentContract));
        PayloadFingerprint = payloadFingerprint ?? throw new ArgumentNullException(nameof(payloadFingerprint));
    }

    public CommandId CommandId { get; }
    public CommandActorBinding Actor { get; }
    public ContractDescriptor IntentContract { get; }
    public CommandPayloadFingerprint PayloadFingerprint { get; }
}

public readonly record struct CommandExecutionToken
{
    public CommandExecutionToken(Guid value)
    {
        if (value == Guid.Empty)
        {
            throw new ArgumentException("Command execution token cannot be empty.", nameof(value));
        }

        Value = value;
    }

    public Guid Value { get; }
    public bool IsEmpty => Value == Guid.Empty;
    public static CommandExecutionToken New() => new(Guid.NewGuid());
}

public sealed record CommandExecutionLeaseRequest
{
    public CommandExecutionLeaseRequest(string workerId, TimeSpan duration)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(workerId);
        if (duration <= TimeSpan.Zero)
        {
            throw new ArgumentOutOfRangeException(nameof(duration), "Command execution lease duration must be positive.");
        }

        WorkerId = workerId.Trim();
        Duration = duration;
    }

    public string WorkerId { get; }
    public TimeSpan Duration { get; }
}

public sealed record CommandReceiptAcquireRequest
{
    public CommandReceiptAcquireRequest(
        CommandExecutionIdentity identity,
        CanonicalCommandPayload payload,
        CorrelationId correlationId,
        DateTimeOffset receivedAtUtc,
        CommandExecutionLeaseRequest executionLease)
    {
        Identity = identity ?? throw new ArgumentNullException(nameof(identity));
        Payload = payload ?? throw new ArgumentNullException(nameof(payload));
        ExecutionLease = executionLease ?? throw new ArgumentNullException(nameof(executionLease));

        if (Identity.PayloadFingerprint != Payload.Fingerprint)
        {
            throw new ArgumentException("Command identity fingerprint must match the canonical recovery payload.", nameof(payload));
        }

        if (correlationId.Value == Guid.Empty)
        {
            throw new ArgumentException("CorrelationId cannot be empty.", nameof(correlationId));
        }

        if (receivedAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Command receive time must be UTC.", nameof(receivedAtUtc));
        }

        CorrelationId = correlationId;
        ReceivedAtUtc = receivedAtUtc;
    }

    public CommandExecutionIdentity Identity { get; }
    public CanonicalCommandPayload Payload { get; }
    public CorrelationId CorrelationId { get; }
    public DateTimeOffset ReceivedAtUtc { get; }
    public CommandExecutionLeaseRequest ExecutionLease { get; }
    public DateTimeOffset LeaseExpiresAtUtc => ReceivedAtUtc + ExecutionLease.Duration;
}

public enum CommandTerminalStatus
{
    Succeeded = 0,
    Rejected = 1,
    Conflict = 2,
    Cancelled = 3,
    DomainFailed = 4,
    TechnicalFailure = 5
}

public sealed record CommandReasonCode
{
    public CommandReasonCode(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        Value = value;
    }

    public string Value { get; }
    public override string ToString() => Value;
}

public sealed record CommandTerminalOutcome
{
    private CommandTerminalOutcome(
        CommandTerminalStatus status,
        CommandReasonCode? reason,
        DateTimeOffset completedAtUtc)
    {
        if (!Enum.IsDefined(typeof(CommandTerminalStatus), status))
        {
            throw new ArgumentOutOfRangeException(nameof(status));
        }

        if (completedAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("Command completion time must be UTC.", nameof(completedAtUtc));
        }

        if (status == CommandTerminalStatus.Succeeded && reason is not null)
        {
            throw new ArgumentException("Succeeded command outcomes cannot carry a failure reason.", nameof(reason));
        }

        if (status != CommandTerminalStatus.Succeeded && reason is null)
        {
            throw new ArgumentNullException(nameof(reason), "Non-success command outcomes require an explicit reason code.");
        }

        Status = status;
        Reason = reason;
        CompletedAtUtc = completedAtUtc;
    }

    public CommandTerminalStatus Status { get; }
    public CommandReasonCode? Reason { get; }
    public DateTimeOffset CompletedAtUtc { get; }

    public static CommandTerminalOutcome Succeeded(DateTimeOffset completedAtUtc) =>
        new(CommandTerminalStatus.Succeeded, null, completedAtUtc);

    public static CommandTerminalOutcome Failed(
        CommandTerminalStatus status,
        CommandReasonCode reason,
        DateTimeOffset completedAtUtc)
    {
        if (status == CommandTerminalStatus.Succeeded)
        {
            throw new ArgumentException("Use Succeeded for successful command outcomes.", nameof(status));
        }

        return new CommandTerminalOutcome(status, reason ?? throw new ArgumentNullException(nameof(reason)), completedAtUtc);
    }
}

public enum CommandReceiptDisposition
{
    Acquired = 0,
    DuplicateInProgress = 1,
    DuplicateCompleted = 2,
    IntegrityViolation = 3
}

public sealed record CommandReceiptClaim
{
    private CommandReceiptClaim(
        CommandReceiptDisposition disposition,
        CorrelationId originalCorrelationId,
        CommandExecutionToken? executionToken,
        CommandTerminalOutcome? terminalOutcome)
    {
        if (originalCorrelationId.Value == Guid.Empty)
        {
            throw new ArgumentException("Original CorrelationId cannot be empty.", nameof(originalCorrelationId));
        }

        Disposition = disposition;
        OriginalCorrelationId = originalCorrelationId;
        ExecutionToken = executionToken;
        TerminalOutcome = terminalOutcome;
    }

    public CommandReceiptDisposition Disposition { get; }
    public CorrelationId OriginalCorrelationId { get; }
    public CommandExecutionToken? ExecutionToken { get; }
    public CommandTerminalOutcome? TerminalOutcome { get; }

    public static CommandReceiptClaim Acquired(CorrelationId correlationId, CommandExecutionToken executionToken)
    {
        if (executionToken.IsEmpty)
        {
            throw new ArgumentException("Acquired command claims require a non-empty execution token.", nameof(executionToken));
        }

        return new CommandReceiptClaim(CommandReceiptDisposition.Acquired, correlationId, executionToken, null);
    }

    public static CommandReceiptClaim DuplicateInProgress(CorrelationId originalCorrelationId) =>
        new(CommandReceiptDisposition.DuplicateInProgress, originalCorrelationId, null, null);

    public static CommandReceiptClaim DuplicateCompleted(
        CorrelationId originalCorrelationId,
        CommandTerminalOutcome terminalOutcome) =>
        new(CommandReceiptDisposition.DuplicateCompleted, originalCorrelationId, null, terminalOutcome ?? throw new ArgumentNullException(nameof(terminalOutcome)));

    public static CommandReceiptClaim IntegrityViolation(CorrelationId originalCorrelationId) =>
        new(CommandReceiptDisposition.IntegrityViolation, originalCorrelationId, null, null);
}

public interface ICommandReceiptRepository
{
    ValueTask<CommandReceiptClaim> TryAcquireAsync(
        CommandReceiptAcquireRequest request,
        CancellationToken cancellationToken = default);
}
