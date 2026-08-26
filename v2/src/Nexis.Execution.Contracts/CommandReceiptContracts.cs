using System.Security.Cryptography;
using Nexis.Core.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;

namespace Nexis.Execution.Contracts;

/// <summary>
/// SHA-256 fingerprint of the canonical, trusted-server representation of a command payload.
/// The digest is derived by trusted ingress code; a client-supplied digest is never authority.
/// </summary>
public sealed record CommandPayloadFingerprint
{
    private const int Sha256HexLength = 64;

    private CommandPayloadFingerprint(string value)
    {
        Value = value;
    }

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

/// <summary>
/// Stable actor identity bound to CommandId idempotency. Current capabilities, entitlements and
/// security/session versions are deliberately excluded because they are revalidated execution facts,
/// not part of the caller identity that owns a retry.
/// </summary>
public sealed record CommandActorBinding
{
    private CommandActorBinding(
        CommandExecutionLane lane,
        AccountId? accountId,
        CharacterId? characterId)
    {
        Lane = lane;
        AccountId = accountId;
        CharacterId = characterId;
    }

    public CommandExecutionLane Lane { get; }

    public AccountId? AccountId { get; }

    public CharacterId? CharacterId { get; }

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
        if (actor.Kind != ActorKind.Player || !actor.AccountId.HasValue || !actor.CharacterId.HasValue)
        {
            throw new InvalidOperationException("Player/realtime command actors require trusted AccountId and CharacterId identity.");
        }

        return new CommandActorBinding(actor.Lane, actor.AccountId.Value, actor.CharacterId.Value);
    }

    private static CommandActorBinding FromStaff(TrustedActorContext actor)
    {
        if (actor.Kind != ActorKind.Staff || !actor.AccountId.HasValue || actor.CharacterId.HasValue)
        {
            throw new InvalidOperationException("Admin command actors require a trusted AccountId and cannot impersonate a CharacterId.");
        }

        return new CommandActorBinding(actor.Lane, actor.AccountId.Value, null);
    }

    private static CommandActorBinding FromSystem(TrustedActorContext actor)
    {
        if (actor.Kind != ActorKind.System || actor.AccountId.HasValue || actor.CharacterId.HasValue)
        {
            throw new InvalidOperationException("System command actors cannot carry account or character identity.");
        }

        return new CommandActorBinding(actor.Lane, null, null);
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

/// <summary>
/// Durable terminal command result after the authoritative transaction has committed (or has
/// definitively failed without a gameplay commit). This is intentionally distinct from CoreDecision:
/// a Core success is not a command success until persistence commits.
/// </summary>
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

/// <summary>
/// Atomic result of attempting to claim one CommandId for execution.
/// </summary>
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
        new(
            CommandReceiptDisposition.DuplicateCompleted,
            originalCorrelationId,
            null,
            terminalOutcome ?? throw new ArgumentNullException(nameof(terminalOutcome)));

    public static CommandReceiptClaim IntegrityViolation(CorrelationId originalCorrelationId) =>
        new(CommandReceiptDisposition.IntegrityViolation, originalCorrelationId, null, null);
}

/// <summary>
/// Durable receipt boundary. TryAcquireAsync must atomically create or compare the CommandId receipt.
/// Terminal completion is deliberately not exposed here; it belongs in the later atomic command
/// transaction contract so owner state, outcome, events and outbox cannot commit independently.
/// </summary>
public interface ICommandReceiptRepository
{
    ValueTask<CommandReceiptClaim> TryAcquireAsync(
        CommandExecutionIdentity identity,
        CorrelationId correlationId,
        DateTimeOffset receivedAtUtc,
        CancellationToken cancellationToken = default);
}
