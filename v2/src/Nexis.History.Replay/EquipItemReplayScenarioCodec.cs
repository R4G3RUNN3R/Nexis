using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Nexis.Combat.Contracts;
using Nexis.Content.Contracts;
using Nexis.Core.Contracts;
using Nexis.Equipment.Contracts;
using Nexis.Execution.Contracts;
using Nexis.Identity.Contracts;
using Nexis.Inventory.Contracts;
using Nexis.Items.Contracts;
using Nexis.Kernel.Commands;
using Nexis.Kernel.Events;
using Nexis.Kernel.Randomness;

namespace Nexis.History.Replay;

/// <summary>
/// Privacy-reviewed replay codec for Equip Item V1. It reconstructs only rule-relevant typed data,
/// pseudonymizes private identities, and deliberately omits raw command JSON, actor security facts,
/// audit data, execution leases/tokens, and unrestricted RNG material.
/// </summary>
public sealed class EquipItemReplayScenarioCodec : IReplayScenarioCodec
{
    private static readonly JsonSerializerOptions JsonOptions = CreateJsonOptions();

    public ContractDescriptor IntentContract => EquipItemIntent.IntentContract;

    public string Encode(ReplayCapture capture, ReplayPseudonymizationKey pseudonymizationKey)
    {
        ArgumentNullException.ThrowIfNull(capture);
        ArgumentNullException.ThrowIfNull(pseudonymizationKey);
        if (capture.Request.Intent is not EquipItemIntent intent)
        {
            throw new ArgumentException("Equip Item replay codec received the wrong typed intent.", nameof(capture));
        }

        var actor = capture.Request.Context.Actor;
        if (actor.Kind != ActorKind.Player ||
            !actor.AccountId.HasValue ||
            !actor.CharacterId.HasValue ||
            actor.SystemActorKey is not null)
        {
            throw new InvalidOperationException("Equip Item replay requires an authoritative player actor.");
        }

        var inventory = RequireSingle<InventorySnapshot>(capture.Request.Snapshots, nameof(capture));
        var equipment = RequireSingle<EquipmentSnapshot>(capture.Request.Snapshots, nameof(capture));
        var combat = RequireSingle<CombatParticipationSnapshot>(capture.Request.Snapshots, nameof(capture));
        if (capture.Request.Snapshots.Count != 3)
        {
            throw new InvalidOperationException("Equip Item replay rejects unreviewed snapshot contracts.");
        }

        var definition = RequireSingle<EquippableItemDefinition>(capture.Request.Content, nameof(capture));
        if (capture.Request.Content.Count != 1)
        {
            throw new InvalidOperationException("Equip Item replay rejects unreviewed content contracts.");
        }

        if (actor.CharacterId.Value != intent.CharacterId ||
            inventory.CharacterId != intent.CharacterId ||
            equipment.CharacterId != intent.CharacterId ||
            combat.CharacterId != intent.CharacterId)
        {
            throw new InvalidOperationException("Equip Item replay identities are inconsistent.");
        }

        ValidateSafeToken(intent.PlacementKey.Value, "placement");
        ValidateSafeToken(definition.DefinitionId.Value, "content definition");
        foreach (var placement in definition.Placements)
        {
            ValidateSafeToken(placement.PlacementKey.Value, "content placement");
            foreach (var slot in placement.OccupiedSlots)
            {
                ValidateSafeToken(slot.Value, "equipment slot");
            }
        }

        var alias = new AliasMap(pseudonymizationKey);
        var decision = NormalizeDecision(capture.Decision, alias.PseudonymizeCharacter, alias.PseudonymizeItem);
        var committedEvents = capture.Plan.Events
            .Select(item => NormalizeCommittedEvent(item, alias))
            .OrderBy(static item => item.EventId)
            .ToArray();
        var document = new EquipReplayDocument(
            ReplayCorpusVersion.V1.Value,
            new ContractDocument(IntentContract.Name, IntentContract.SchemaVersion),
            capture.Metadata.ProvenanceKind,
            capture.Metadata.SourceFingerprint.Value,
            FormatUtc(capture.Metadata.CapturedAtUtc),
            capture.Metadata.Tags.ToArray(),
            capture.Metadata.PersistenceOutcome,
            capture.Metadata.EvaluationDuration.Ticks,
            capture.Metadata.RandomReference.Value,
            new ExecutionDocument(
                capture.Request.Context.CommandId.Value,
                capture.Plan.Trace.CorrelationId.Value,
                capture.Plan.Trace.Identity.PayloadFingerprint.Value,
                capture.Plan.Trace.CoreImplementation.ImplementationName,
                capture.Plan.Trace.CoreImplementation.ImplementationVersion,
                capture.Plan.Trace.CoreContractVersion.Value,
                capture.Plan.Trace.RuleVersion.Value,
                capture.Plan.Trace.ContentVersion.Value,
                FormatUtc(capture.Plan.Trace.EvaluatedAtUtc),
                FormatUtc(capture.Plan.TerminalOutcome.CompletedAtUtc),
                capture.Plan.TerminalOutcome.Status,
                capture.Plan.TerminalOutcome.Reason?.Value),
            new ActorDocument(
                capture.Request.Context.Actor.Lane,
                alias.PseudonymizeAccount(actor.AccountId.Value.Value),
                alias.PseudonymizeCharacter(actor.CharacterId.Value.Value)),
            new IntentDocument(
                alias.PseudonymizeCharacter(intent.CharacterId.Value),
                alias.PseudonymizeItem(intent.ItemInstanceId.Value),
                intent.PlacementKey.Value),
            new InventoryDocument(
                inventory.Revision,
                inventory.Items
                    .Select(item => new InventoryItemDocument(
                        alias.PseudonymizeItem(item.ItemInstanceId.Value),
                        new ContractDocument(item.DefinitionKey.Contract.Name, item.DefinitionKey.Contract.SchemaVersion),
                        item.DefinitionKey.DefinitionId.Value))
                    .OrderBy(static item => item.ItemInstanceId)
                    .ToArray()),
            new EquipmentDocument(
                equipment.Revision,
                equipment.Bindings
                    .Select(binding => new EquipmentBindingDocument(
                        alias.PseudonymizeItem(binding.ItemInstanceId.Value),
                        binding.PlacementKey.Value,
                        binding.OccupiedSlots.Select(static slot => slot.Value).Order(StringComparer.Ordinal).ToArray()))
                    .OrderBy(static binding => binding.ItemInstanceId)
                    .ToArray()),
            new CombatDocument(combat.Revision, combat.IsInActiveCombat),
            new ContentDocument(
                definition.DefinitionId.Value,
                definition.Placements
                    .Select(placement => new PlacementDocument(
                        placement.PlacementKey.Value,
                        placement.OccupiedSlots.Select(static slot => slot.Value).Order(StringComparer.Ordinal).ToArray()))
                    .OrderBy(static placement => placement.Placement, StringComparer.Ordinal)
                    .ToArray()),
            decision,
            committedEvents);

        return JsonSerializer.Serialize(document, JsonOptions);
    }

    public ReplayExecutableScenario Decode(
        string canonicalJson,
        IRestrictedReplayRandomResolver randomResolver)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(canonicalJson);
        ArgumentNullException.ThrowIfNull(randomResolver);
        var document = DeserializeCanonicalDocument(canonicalJson);

        var randomFactory = randomResolver.Resolve(new RestrictedReplayRandomReference(document.RestrictedRandomReference))
            ?? throw new InvalidOperationException("Restricted replay RNG resolver returned null.");
        var characterId = new CharacterId(document.Intent.CharacterId);
        var itemId = new ItemInstanceId(document.Intent.ItemInstanceId);
        var definition = new EquippableItemDefinition(
            new ContentDefinitionId(document.Content.DefinitionId),
            document.Content.Placements.Select(static placement =>
                new EquipmentPlacementDefinition(
                    new EquipmentPlacementKey(placement.Placement),
                    placement.OccupiedSlots.Select(static slot => new EquipmentSlotKey(slot)))));
        var request = new CoreEvaluationRequest(
            new CoreContractVersion(document.Execution.CoreContractVersion),
            new CoreEvaluationContext(
                new CommandId(document.Execution.CommandId),
                new CorrelationId(document.Execution.CorrelationId),
                TrustedActorContext.CreatePlayer(
                    new AccountId(document.Actor.AccountId),
                    new CharacterId(document.Actor.CharacterId),
                    securityVersion: 0,
                    realtime: document.Actor.Lane == CommandExecutionLane.Realtime),
                ParseUtc(document.Execution.EvaluatedAtUtc),
                new RuleVersion(document.Execution.RuleVersion),
                new ContentVersion(document.Execution.ContentVersion),
                randomFactory),
            new EquipItemIntent(characterId, itemId, new EquipmentPlacementKey(document.Intent.Placement)),
            new IAuthoritativeSnapshot[]
            {
                new InventorySnapshot(
                    characterId,
                    document.Inventory.Revision,
                    document.Inventory.Items.Select(static item =>
                        new InventoryItemReference(
                            new ItemInstanceId(item.ItemInstanceId),
                            new ContentDefinitionKey(
                                new ContractDescriptor(item.DefinitionContract.Name, item.DefinitionContract.SchemaVersion),
                                new ContentDefinitionId(item.DefinitionId))))),
                new EquipmentSnapshot(
                    characterId,
                    document.Equipment.Revision,
                    document.Equipment.Bindings.Select(static binding =>
                        new EquippedItemBinding(
                            new ItemInstanceId(binding.ItemInstanceId),
                            new EquipmentPlacementKey(binding.Placement),
                            binding.OccupiedSlots.Select(static slot => new EquipmentSlotKey(slot))))),
                new CombatParticipationSnapshot(
                    characterId,
                    document.Combat.Revision,
                    document.Combat.IsInActiveCombat)
            },
            new[] { definition });

        return new ReplayExecutableScenario(
            request,
            JsonSerializer.Serialize(document.Decision, JsonOptions));
    }

    public string DecisionFingerprint(CoreDecision decision)
    {
        ArgumentNullException.ThrowIfNull(decision);
        var normalized = NormalizeDecision(
            decision,
            static value => value,
            static value => value);
        return JsonSerializer.Serialize(normalized, JsonOptions);
    }

    private static DecisionDocument NormalizeDecision(
        CoreDecision decision,
        Func<Guid, Guid> pseudonymizeCharacter,
        Func<Guid, Guid> pseudonymizeItem)
    {
        if (decision.Payload is not null)
        {
            throw new InvalidOperationException("Equip Item replay rejects unreviewed result payload contracts.");
        }

        var transitions = decision.Transitions.Select(transition =>
        {
            if (transition is not EquipItemTransition equip)
            {
                throw new InvalidOperationException("Equip Item replay rejects unreviewed transition contracts.");
            }

            return new TransitionDocument(
                equip.ExpectedRevision,
                pseudonymizeCharacter(equip.CharacterId.Value),
                pseudonymizeItem(equip.ItemInstanceId.Value),
                equip.PlacementKey.Value,
                equip.OccupiedSlots.Select(static slot => slot.Value).Order(StringComparer.Ordinal).ToArray());
        }).OrderBy(static transition => transition.ItemInstanceId).ToArray();

        var events = decision.Events.Select(domainEvent =>
        {
            if (domainEvent is not ItemEquippedEvent equipped)
            {
                throw new InvalidOperationException("Equip Item replay rejects unreviewed event contracts.");
            }

            return new EventDocument(
                pseudonymizeCharacter(equipped.CharacterId.Value),
                pseudonymizeItem(equipped.ItemInstanceId.Value),
                equipped.PlacementKey.Value,
                equipped.OccupiedSlots.Select(static slot => slot.Value).Order(StringComparer.Ordinal).ToArray());
        }).OrderBy(static domainEvent => domainEvent.ItemInstanceId).ToArray();

        return new DecisionDocument(decision.Status, decision.Reason?.Value, transitions, events);
    }

    private static CommittedEventDocument NormalizeCommittedEvent(
        AuthoritativeEventEnvelope envelope,
        AliasMap alias)
    {
        if (envelope.Descriptor is not ItemEquippedEvent equipped)
        {
            throw new InvalidOperationException("Equip Item replay rejects unreviewed committed event contracts.");
        }

        return new CommittedEventDocument(
            envelope.Metadata.EventId.Value,
            envelope.Metadata.CorrelationId.Value,
            envelope.Metadata.CausationId?.Value,
            FormatUtc(envelope.Metadata.OccurredAtUtc),
            new ContractDocument(envelope.Descriptor.Contract.Name, envelope.Descriptor.Contract.SchemaVersion),
            new EventDocument(
                alias.PseudonymizeCharacter(equipped.CharacterId.Value),
                alias.PseudonymizeItem(equipped.ItemInstanceId.Value),
                equipped.PlacementKey.Value,
                equipped.OccupiedSlots.Select(static slot => slot.Value).Order(StringComparer.Ordinal).ToArray()));
    }

    private static T RequireSingle<T>(IEnumerable<object> values, string parameterName)
        where T : class
    {
        var matches = values.OfType<T>().ToArray();
        if (matches.Length != 1)
        {
            throw new ArgumentException($"Replay capture requires exactly one {typeof(T).Name}.", parameterName);
        }

        return matches[0];
    }

    internal static void ValidateCanonicalEnvelope(string canonicalJson) =>
        _ = DeserializeCanonicalDocument(canonicalJson);

    private static EquipReplayDocument DeserializeCanonicalDocument(string canonicalJson)
    {
        var document = DeserializeDocument(canonicalJson);
        if (document.CorpusVersion != ReplayCorpusVersion.V1.Value ||
            document.IntentContract != new ContractDocument(
                EquipItemIntent.IntentContract.Name,
                EquipItemIntent.IntentContract.SchemaVersion))
        {
            throw new NotSupportedException(
                "Equip Item replay document has an unsupported corpus or intent contract version.");
        }

        if (!StringComparer.Ordinal.Equals(
            canonicalJson,
            JsonSerializer.Serialize(document, JsonOptions)))
        {
            throw new FormatException("Replay corpus artifact is not in the exact canonical JSON form.");
        }

        ValidateDomainInvariants(document);
        return document;
    }


    private static EquipReplayDocument DeserializeDocument(string canonicalJson)
    {
        try
        {
            return JsonSerializer.Deserialize<EquipReplayDocument>(canonicalJson, JsonOptions)
                ?? throw new FormatException("Equip Item replay document cannot be null.");
        }
        catch (JsonException exception)
        {
            throw new FormatException(
                "Replay corpus artifact does not match the exact reviewed schema.",
                exception);
        }
    }

    private static void ValidateSafeToken(string value, string field)
    {
        if (value.Length > 200 ||
            value.Any(static character =>
                !(char.IsAsciiLetterOrDigit(character) || character is '.' or '-' or '_' or ':' or '/')))
        {
            throw new InvalidOperationException(
                $"Replay {field} contains characters outside the reviewed normalized identifier vocabulary.");
        }
    }

    private static string FormatUtc(DateTimeOffset value) =>
        value.ToString("O", CultureInfo.InvariantCulture);

    private static DateTimeOffset ParseUtc(string value)
    {
        var parsed = DateTimeOffset.ParseExact(value, "O", CultureInfo.InvariantCulture);
        if (parsed.Offset != TimeSpan.Zero)
        {
            throw new FormatException("Replay authoritative timestamps must be UTC.");
        }

        return parsed;
    }

    private static JsonSerializerOptions CreateJsonOptions()
    {
        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
        };
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        return options;
    }

    private sealed class AliasMap
    {
        private readonly ReplayPseudonymizationKey _key;

        public AliasMap(ReplayPseudonymizationKey key) => _key = key;

        public Guid PseudonymizeAccount(Guid value) => _key.Pseudonymize(value, "account");

        public Guid PseudonymizeCharacter(Guid value) => _key.Pseudonymize(value, "character");

        public Guid PseudonymizeItem(Guid value) => _key.Pseudonymize(value, "item-instance");
    }

    private sealed record EquipReplayDocument(
        int CorpusVersion,
        ContractDocument IntentContract,
        ReplayProvenanceKind ProvenanceKind,
        string SourceFingerprint,
        string CapturedAtUtc,
        ReplayScenarioTag[] Tags,
        ReplayPersistenceOutcome PersistenceOutcome,
        long EvaluationDurationTicks,
        Guid RestrictedRandomReference,
        ExecutionDocument Execution,
        ActorDocument Actor,
        IntentDocument Intent,
        InventoryDocument Inventory,
        EquipmentDocument Equipment,
        CombatDocument Combat,
        ContentDocument Content,
        DecisionDocument Decision,
        CommittedEventDocument[] CommittedEvents);

    private sealed record ContractDocument(string Name, int SchemaVersion);

    private sealed record ExecutionDocument(
        Guid CommandId,
        Guid CorrelationId,
        string PayloadFingerprint,
        string CoreImplementationName,
        string CoreImplementationVersion,
        int CoreContractVersion,
        string RuleVersion,
        string ContentVersion,
        string EvaluatedAtUtc,
        string CompletedAtUtc,
        CommandTerminalStatus TerminalStatus,
        string? TerminalReason);

    private sealed record ActorDocument(
        CommandExecutionLane Lane,
        Guid AccountId,
        Guid CharacterId);

    private sealed record IntentDocument(
        Guid CharacterId,
        Guid ItemInstanceId,
        string Placement);

    private sealed record InventoryDocument(
        long Revision,
        InventoryItemDocument[] Items);

    private sealed record InventoryItemDocument(
        Guid ItemInstanceId,
        ContractDocument DefinitionContract,
        string DefinitionId);

    private sealed record EquipmentDocument(
        long Revision,
        EquipmentBindingDocument[] Bindings);

    private sealed record EquipmentBindingDocument(
        Guid ItemInstanceId,
        string Placement,
        string[] OccupiedSlots);

    private sealed record CombatDocument(
        long Revision,
        bool IsInActiveCombat);

    private sealed record ContentDocument(
        string DefinitionId,
        PlacementDocument[] Placements);

    private sealed record PlacementDocument(
        string Placement,
        string[] OccupiedSlots);

    private sealed record DecisionDocument(
        CoreOutcomeStatus Status,
        string? Reason,
        TransitionDocument[] Transitions,
        EventDocument[] Events);

    private sealed record TransitionDocument(
        long? ExpectedRevision,
        Guid CharacterId,
        Guid ItemInstanceId,
        string Placement,
        string[] OccupiedSlots);

    private sealed record EventDocument(
        Guid CharacterId,
        Guid ItemInstanceId,
        string Placement,
        string[] OccupiedSlots);

    private sealed record CommittedEventDocument(
        Guid EventId,
        Guid CorrelationId,
        Guid? CausationId,
        string OccurredAtUtc,
        ContractDocument Contract,
        EventDocument Event);
    private static void ValidateDomainInvariants(EquipReplayDocument document)
    {
        try
        {
            var metadata = new ReplayCaptureMetadata(
                document.ProvenanceKind,
                ReplaySourceFingerprint.Parse(document.SourceFingerprint),
                ParseUtc(document.CapturedAtUtc),
                document.Tags,
                new RestrictedReplayRandomReference(document.RestrictedRandomReference),
                TimeSpan.FromTicks(document.EvaluationDurationTicks),
                document.PersistenceOutcome);
            if (!metadata.Tags.SequenceEqual(document.Tags))
            {
                throw new InvalidOperationException("Replay scenario tags must be in canonical domain order without duplicates.");
            }

            if (document.Actor.Lane is not (CommandExecutionLane.Player or CommandExecutionLane.Realtime))
            {
                throw new InvalidOperationException("Equip Item replay artifacts require a player or realtime actor lane.");
            }

            var actor = TrustedActorContext.CreatePlayer(
                new AccountId(document.Actor.AccountId),
                new CharacterId(document.Actor.CharacterId),
                securityVersion: 0,
                realtime: document.Actor.Lane == CommandExecutionLane.Realtime);
            var characterId = new CharacterId(document.Intent.CharacterId);
            if (actor.CharacterId != characterId)
            {
                throw new InvalidOperationException("Equip Item replay actor and intent identities are inconsistent.");
            }

            var coreContractVersion = new CoreContractVersion(document.Execution.CoreContractVersion);
            _ = new CoreImplementationDescriptor(
                document.Execution.CoreImplementationName,
                document.Execution.CoreImplementationVersion,
                coreContractVersion);
            _ = CommandPayloadFingerprint.Parse(document.Execution.PayloadFingerprint);
            var context = new CoreEvaluationContext(
                new CommandId(document.Execution.CommandId),
                new CorrelationId(document.Execution.CorrelationId),
                actor,
                ParseUtc(document.Execution.EvaluatedAtUtc),
                new RuleVersion(document.Execution.RuleVersion),
                new ContentVersion(document.Execution.ContentVersion),
                DomainValidationRandomFactory.Instance);
            var intent = new EquipItemIntent(
                characterId,
                new ItemInstanceId(document.Intent.ItemInstanceId),
                new EquipmentPlacementKey(document.Intent.Placement));
            var inventory = new InventorySnapshot(
                characterId,
                document.Inventory.Revision,
                document.Inventory.Items.Select(static item => new InventoryItemReference(
                    new ItemInstanceId(item.ItemInstanceId),
                    new ContentDefinitionKey(
                        new ContractDescriptor(item.DefinitionContract.Name, item.DefinitionContract.SchemaVersion),
                        new ContentDefinitionId(item.DefinitionId)))));
            var equipment = new EquipmentSnapshot(
                characterId,
                document.Equipment.Revision,
                document.Equipment.Bindings.Select(static binding => new EquippedItemBinding(
                    new ItemInstanceId(binding.ItemInstanceId),
                    new EquipmentPlacementKey(binding.Placement),
                    binding.OccupiedSlots.Select(static slot => new EquipmentSlotKey(slot)))));
            var combat = new CombatParticipationSnapshot(
                characterId,
                document.Combat.Revision,
                document.Combat.IsInActiveCombat);
            var content = new EquippableItemDefinition(
                new ContentDefinitionId(document.Content.DefinitionId),
                document.Content.Placements.Select(static placement => new EquipmentPlacementDefinition(
                    new EquipmentPlacementKey(placement.Placement),
                    placement.OccupiedSlots.Select(static slot => new EquipmentSlotKey(slot)))));
            _ = new CoreEvaluationRequest(
                coreContractVersion,
                context,
                intent,
                new IAuthoritativeSnapshot[] { inventory, equipment, combat },
                new[] { content });

            var decision = ValidateDecision(document.Decision);
            var completedAtUtc = ParseUtc(document.Execution.CompletedAtUtc);
            var terminalOutcome = document.Execution.TerminalStatus == CommandTerminalStatus.Succeeded
                ? CommandTerminalOutcome.Succeeded(completedAtUtc)
                : CommandTerminalOutcome.Failed(
                    document.Execution.TerminalStatus,
                    new CommandReasonCode(document.Execution.TerminalReason!),
                    completedAtUtc);
            if ((CoreOutcomeStatus)terminalOutcome.Status != decision.Status ||
                terminalOutcome.Reason?.Value != decision.Reason?.Value)
            {
                throw new InvalidOperationException("Replay decision and terminal outcome are inconsistent.");
            }

            foreach (var committedEvent in document.CommittedEvents)
            {
                var contract = new ContractDescriptor(
                    committedEvent.Contract.Name,
                    committedEvent.Contract.SchemaVersion);
                if (contract != ItemEquippedEvent.EventContract)
                {
                    throw new InvalidOperationException("Equip Item replay committed event uses an unexpected contract.");
                }

                _ = new AuthoritativeEventEnvelope(
                    new EventMetadata(
                        new EventId(committedEvent.EventId),
                        ParseUtc(committedEvent.OccurredAtUtc),
                        new CorrelationId(committedEvent.CorrelationId),
                        committedEvent.CausationId.HasValue ? new EventId(committedEvent.CausationId.Value) : null,
                        contract.SchemaVersion),
                    CreateEvent(committedEvent.Event));
            }
        }
        catch (Exception exception) when (exception is ArgumentException or FormatException or InvalidOperationException or NullReferenceException)
        {
            throw new FormatException("Replay corpus artifact violates the reviewed Equip Item domain invariants.", exception);
        }
    }

    private static CoreDecision ValidateDecision(DecisionDocument document)
    {
        if (!Enum.IsDefined(document.Status))
        {
            throw new ArgumentOutOfRangeException(nameof(document), "Replay decision status is undefined.");
        }

        var transitions = document.Transitions.Select(static transition => new EquipItemTransition(
            transition.ExpectedRevision
                ?? throw new InvalidOperationException("Equip Item replay transitions require an expected revision."),
            new CharacterId(transition.CharacterId),
            new ItemInstanceId(transition.ItemInstanceId),
            new EquipmentPlacementKey(transition.Placement),
            transition.OccupiedSlots.Select(static slot => new EquipmentSlotKey(slot))));
        var events = document.Events.Select(CreateEvent);
        return document.Status switch
        {
            CoreOutcomeStatus.Succeeded when document.Reason is null =>
                CoreDecision.Succeeded(transitions: transitions, events: events),
            CoreOutcomeStatus.DomainFailed when document.Reason is not null =>
                CoreDecision.DomainFailed(new CoreReasonCode(document.Reason), transitions: transitions, events: events),
            CoreOutcomeStatus.Rejected when document.Reason is not null && document.Transitions.Length == 0 && document.Events.Length == 0 =>
                CoreDecision.Rejected(new CoreReasonCode(document.Reason)),
            CoreOutcomeStatus.Conflict when document.Reason is not null && document.Transitions.Length == 0 && document.Events.Length == 0 =>
                CoreDecision.Conflict(new CoreReasonCode(document.Reason)),
            CoreOutcomeStatus.Cancelled when document.Reason is not null && document.Transitions.Length == 0 && document.Events.Length == 0 =>
                CoreDecision.Cancelled(new CoreReasonCode(document.Reason)),
            CoreOutcomeStatus.TechnicalFailure when document.Reason is not null && document.Transitions.Length == 0 && document.Events.Length == 0 =>
                CoreDecision.TechnicalFailure(new CoreReasonCode(document.Reason)),
            _ => throw new InvalidOperationException("Replay decision status, reason, and mutation shape are inconsistent.")
        };
    }

    private static ItemEquippedEvent CreateEvent(EventDocument document) =>
        new(
            new CharacterId(document.CharacterId),
            new ItemInstanceId(document.ItemInstanceId),
            new EquipmentPlacementKey(document.Placement),
            document.OccupiedSlots.Select(static slot => new EquipmentSlotKey(slot)));

    private sealed class DomainValidationRandomFactory : IDeterministicRandomFactory
    {
        public static DomainValidationRandomFactory Instance { get; } = new();

        public IDeterministicRandomSource Create() => throw new NotSupportedException();
    }

}
