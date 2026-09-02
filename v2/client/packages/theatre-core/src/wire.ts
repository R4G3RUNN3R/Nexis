import { PRESENTATION_CONTRACT_VERSION, type BattlePresentationSnapshot, type PresentationActor, type PresentationActorId, type PresentationAttachment, type PresentationDecodeFailureReason, type PresentationDecodeResult, type PresentationEvent, type PresentationResource, type PresentationResourceResult, type PresentationStatus, type TheatreIntent } from './contracts.ts';

type WireRecord = Record<string, unknown>;
const ACTOR_SELECTOR = /^actor_[A-Za-z0-9][A-Za-z0-9._~-]{0,127}$/;

/** Strict V1 decoding rejects unknown fields and rebuilds/deep-freezes retained data. */
export function decodeBattlePresentationSnapshot(input: unknown): PresentationDecodeResult<BattlePresentationSnapshot> {
  const root = exact(input, ['contractVersion', 'encounterId', 'revision', 'eventCursor', 'phase', 'roundNumber', 'activeActorId', 'actors', 'outcome']);
  if (!root.ok) return root;
  const version = versionV1(root.value['contractVersion']); if (!version.ok) return version;
  if (!Array.isArray(root.value['actors'])) return fail('invalidShape', 'actors must be an array');
  const actors: PresentationActor[] = [];
  for (const candidate of root.value['actors']) { const actor = decodeActor(candidate); if (!actor.ok) return actor; actors.push(actor.value); }
  const encounterId = text(root.value['encounterId']); const revision = integer(root.value['revision'], 0); const eventCursor = integer(root.value['eventCursor'], 0); const roundNumber = integer(root.value['roundNumber'], 0);
  const phase = oneOf(root.value['phase'], ['active', 'ended'] as const); const outcome = nullableOneOf(root.value['outcome'], ['victory', 'defeat', 'withdrawn', 'ended'] as const); const activeActorId = nullableActor(root.value['activeActorId']);
  if (!encounterId.ok || !revision.ok || !eventCursor.ok || !roundNumber.ok || !phase.ok || !outcome.ok || !activeActorId.ok) return fail('invalidShape', 'invalid snapshot scalar');
  const actorIds = new Set(actors.map((actor) => actor.actorId));
  if (actorIds.size !== actors.length || (activeActorId.value !== null && !actorIds.has(activeActorId.value))) return fail('invalidReference', 'invalid actor reference');
  if (phase.value === 'ended' && actors.some((actor) => actor.isLegalTarget)) return fail('invalidReference', 'ended snapshot offers a target');
  return ok(freeze({ contractVersion: PRESENTATION_CONTRACT_VERSION, encounterId: encounterId.value, revision: revision.value, eventCursor: eventCursor.value, phase: phase.value, roundNumber: roundNumber.value, activeActorId: activeActorId.value, actors, outcome: outcome.value, interactionState: 'ready' as const }));
}

export function decodePresentationEvent(input: unknown): PresentationDecodeResult<PresentationEvent> {
  if (!record(input)) return fail('invalidShape', 'event must be an object');
  const version = versionV1(input['contractVersion']); if (!version.ok) return version;
  const type = input['type']; if (typeof type !== 'string' || EVENT_KEYS[type] === undefined) return fail('unknownVariant', 'unknown V1 event variant');
  const checked = exact(input, EVENT_KEYS[type]!, OPTIONAL_EVENT_KEYS[type] ?? []); if (!checked.ok) return checked;
  const envelope = eventEnvelope(checked.value); if (!envelope.ok) return envelope;
  const value = checked.value;
  switch (type) {
    case 'actorMoved': { const actorId = actor(value['actorId']); const movement = oneOf(value['movement'], ['advanceToTarget', 'returnToPosition'] as const); const target = optionalActor(value, 'targetActorId'); if (!actorId.ok || !movement.ok || !target.ok) return invalid(type); return ok(freeze({ ...envelope.value, type, actorId: actorId.value, movement: movement.value, ...(target.value === undefined ? {} : { targetActorId: target.value }) })); }
    case 'skillActivated': { const actorId = actor(value['actorId']); const visual = text(value['skillVisualKey']); const name = text(value['displayName']); const animation = optionalText(value, 'animationIntent'); if (!actorId.ok || !visual.ok || !name.ok || !animation.ok) return invalid(type); return ok(freeze({ ...envelope.value, type, actorId: actorId.value, skillVisualKey: visual.value, displayName: name.value, ...(animation.value === undefined ? {} : { animationIntent: animation.value }) })); }
    case 'attackResolved': { const actorId = actor(value['actorId']); const target = actor(value['targetActorId']); const outcome = oneOf(value['outcome'], ['hit', 'critical', 'miss', 'blocked', 'dodged', 'parried', 'guarded'] as const); if (!actorId.ok || !target.ok || !outcome.ok) return invalid(type); return ok(freeze({ ...envelope.value, type, actorId: actorId.value, targetActorId: target.value, outcome: outcome.value })); }
    case 'damageApplied': case 'healingApplied': { const target = actor(value['targetActorId']); const amount = finite(value['displayAmount']); const resource = decodeResourceResult(value['resultingResource']); if (!target.ok || !amount.ok || !resource.ok) return invalid(type); return ok(freeze({ ...envelope.value, type, targetActorId: target.value, displayAmount: amount.value, resultingResource: resource.value })); }
    case 'resourceChanged': { const actorId = actor(value['actorId']); const resource = decodeResourceResult(value['resultingResource']); if (!actorId.ok || !resource.ok) return invalid(type); return ok(freeze({ ...envelope.value, type, actorId: actorId.value, resultingResource: resource.value })); }
    case 'statusApplied': { const actorId = actor(value['actorId']); const status = decodeStatus(value['status']); if (!actorId.ok || !status.ok) return invalid(type); return ok(freeze({ ...envelope.value, type, actorId: actorId.value, status: status.value })); }
    case 'statusRemoved': { const actorId = actor(value['actorId']); const statusId = text(value['statusInstanceId']); if (!actorId.ok || !statusId.ok) return invalid(type); return ok(freeze({ ...envelope.value, type, actorId: actorId.value, statusInstanceId: statusId.value })); }
    case 'itemUsed': { const actorId = actor(value['actorId']); const visual = text(value['itemVisualKey']); const name = text(value['displayName']); if (!actorId.ok || !visual.ok || !name.ok) return invalid(type); return ok(freeze({ ...envelope.value, type, actorId: actorId.value, itemVisualKey: visual.value, displayName: name.value })); }
    case 'actorDefeated': { const actorId = actor(value['actorId']); return actorId.ok ? ok(freeze({ ...envelope.value, type, actorId: actorId.value })) : invalid(type); }
    case 'turnChanged': { const round = integer(value['roundNumber'], 0); const active = nullableActor(value['activeActorId']); if (!round.ok || !active.ok) return invalid(type); return ok(freeze({ ...envelope.value, type, roundNumber: round.value, activeActorId: active.value })); }
    case 'combatMessage': { const message = text(value['message']); return message.ok ? ok(freeze({ ...envelope.value, type, message: message.value })) : invalid(type); }
    case 'encounterEnded': { const outcome = oneOf(value['outcome'], ['victory', 'defeat', 'withdrawn', 'ended'] as const); return outcome.ok ? ok(freeze({ ...envelope.value, type, outcome: outcome.value })) : invalid(type); }
    default: return fail('unknownVariant', 'unknown V1 event variant');
  }
}

export function decodeTheatreIntent(input: unknown): PresentationDecodeResult<TheatreIntent> {
  if (!record(input)) return fail('invalidShape', 'intent must be an object');
  const version = versionV1(input['contractVersion']); if (!version.ok) return version;
  const kind = input['kind']; if (typeof kind !== 'string' || INTENT_KEYS[kind] === undefined) return fail('unknownVariant', 'unknown V1 intent variant');
  const checked = exact(input, INTENT_KEYS[kind]!, OPTIONAL_INTENT_KEYS[kind] ?? []); if (!checked.ok) return checked;
  const encounterId = text(checked.value['encounterId']); if (!encounterId.ok) return fail('invalidShape', 'invalid encounterId');
  const base = { contractVersion: PRESENTATION_CONTRACT_VERSION, encounterId: encounterId.value };
  switch (kind) {
    case 'defend': case 'withdraw': return ok(freeze({ ...base, kind }));
    case 'useSkill': { const skillId = text(checked.value['skillId']); const target = optionalActor(checked.value, 'targetActorId'); if (!skillId.ok || !target.ok) return invalid(kind); return ok(freeze({ ...base, kind, skillId: skillId.value, ...(target.value === undefined ? {} : { targetActorId: target.value }) })); }
    case 'useItem': { const itemId = text(checked.value['itemId']); const target = optionalActor(checked.value, 'targetActorId'); if (!itemId.ok || !target.ok) return invalid(kind); return ok(freeze({ ...base, kind, itemId: itemId.value, ...(target.value === undefined ? {} : { targetActorId: target.value }) })); }
    case 'basicAttack': case 'selectTarget': case 'inspect': { const target = actor(checked.value['targetActorId']); return target.ok ? ok(freeze({ ...base, kind, targetActorId: target.value })) : invalid(kind); }
    default: return fail('unknownVariant', 'unknown V1 intent variant');
  }
}

function decodeActor(input: unknown): PresentationDecodeResult<PresentationActor> {
  const value = exact(input, ['actorId', 'displayName', 'side', 'facing', 'visualKey', 'resources', 'statuses', 'attachments', 'defeated', 'isLegalTarget']); if (!value.ok) return value;
  const id = actor(value.value['actorId']); const name = text(value.value['displayName']); const side = oneOf(value.value['side'], ['ally', 'hostile'] as const); const facing = oneOf(value.value['facing'], ['left', 'right'] as const); const visual = text(value.value['visualKey']);
  const resources = array(value.value['resources'], decodeResource); const statuses = array(value.value['statuses'], decodeStatus); const attachments = array(value.value['attachments'], decodeAttachment);
  const defeated = value.value['defeated']; const legal = value.value['isLegalTarget'];
  if (!id.ok || !name.ok || !side.ok || !facing.ok || !visual.ok || !resources.ok || !statuses.ok || !attachments.ok || typeof defeated !== 'boolean' || typeof legal !== 'boolean') return fail('invalidShape', 'invalid actor');
  if (defeated && legal) return fail('invalidReference', 'defeated actor offered as target');
  return ok(freeze({ actorId: id.value, displayName: name.value, side: side.value, facing: facing.value, visualKey: visual.value, resources: resources.value, statuses: statuses.value, attachments: attachments.value, defeated, isLegalTarget: legal }));
}
function decodeResource(input: unknown): PresentationDecodeResult<PresentationResource> { const value = exact(input, ['resourceId', 'displayName', 'current', 'maximum']); if (!value.ok) return value; const id = text(value.value['resourceId']); const name = text(value.value['displayName']); const current = finite(value.value['current']); const maximum = finite(value.value['maximum']); return id.ok && name.ok && current.ok && maximum.ok ? ok({ resourceId: id.value, displayName: name.value, current: current.value, maximum: maximum.value }) : invalid('resource'); }
function decodeResourceResult(input: unknown): PresentationDecodeResult<PresentationResourceResult> { const value = exact(input, ['resourceId', 'resultingValue', 'resultingMaximum']); if (!value.ok) return value; const id = text(value.value['resourceId']); const current = finite(value.value['resultingValue']); const maximum = finite(value.value['resultingMaximum']); return id.ok && current.ok && maximum.ok ? ok({ resourceId: id.value, resultingValue: current.value, resultingMaximum: maximum.value }) : invalid('resource result'); }
function decodeAttachment(input: unknown): PresentationDecodeResult<PresentationAttachment> { const value = exact(input, ['slotKey', 'visualKey']); if (!value.ok) return value; const slot = text(value.value['slotKey']); const visual = text(value.value['visualKey']); return slot.ok && visual.ok ? ok({ slotKey: slot.value, visualKey: visual.value }) : invalid('attachment'); }
function decodeStatus(input: unknown): PresentationDecodeResult<PresentationStatus> {
  if (!record(input)) return fail('invalidShape', 'status must be an object');
  if (input['kind'] === 'opaque') { const value = exact(input, ['kind', 'instanceId', 'displayName']); if (!value.ok) return value; const id = text(value.value['instanceId']); const name = text(value.value['displayName']); return id.ok && name.ok ? ok({ kind: 'opaque', instanceId: id.value, displayName: name.value }) : invalid('opaque status'); }
  if (input['kind'] !== 'known') return fail('unknownVariant', 'unknown status variant');
  const value = exact(input, ['kind', 'instanceId', 'statusId', 'displayName', 'polarity', 'stacks', 'remainingRounds'], ['stacks', 'remainingRounds']); if (!value.ok) return value;
  const id = text(value.value['instanceId']); const statusId = text(value.value['statusId']); const name = text(value.value['displayName']); const polarity = oneOf(value.value['polarity'], ['beneficial', 'harmful', 'neutral'] as const); const stacks = optionalInteger(value.value, 'stacks'); const rounds = optionalInteger(value.value, 'remainingRounds');
  if (!id.ok || !statusId.ok || !name.ok || !polarity.ok || !stacks.ok || !rounds.ok) return invalid('known status');
  return ok({ kind: 'known', instanceId: id.value, statusId: statusId.value, displayName: name.value, polarity: polarity.value, ...(stacks.value === undefined ? {} : { stacks: stacks.value }), ...(rounds.value === undefined ? {} : { remainingRounds: rounds.value }) });
}

const BASE = ['contractVersion', 'encounterId', 'type', 'eventId', 'sequence'] as const;
const EVENT_KEYS: Record<string, readonly string[]> = {
  actorMoved: [...BASE, 'actorId', 'movement', 'targetActorId'], skillActivated: [...BASE, 'actorId', 'skillVisualKey', 'displayName', 'animationIntent'], attackResolved: [...BASE, 'actorId', 'targetActorId', 'outcome'], damageApplied: [...BASE, 'targetActorId', 'displayAmount', 'resultingResource'], healingApplied: [...BASE, 'targetActorId', 'displayAmount', 'resultingResource'], resourceChanged: [...BASE, 'actorId', 'resultingResource'], statusApplied: [...BASE, 'actorId', 'status'], statusRemoved: [...BASE, 'actorId', 'statusInstanceId'], itemUsed: [...BASE, 'actorId', 'itemVisualKey', 'displayName'], actorDefeated: [...BASE, 'actorId'], turnChanged: [...BASE, 'roundNumber', 'activeActorId'], combatMessage: [...BASE, 'message'], encounterEnded: [...BASE, 'outcome'],
};
const OPTIONAL_EVENT_KEYS: Record<string, readonly string[]> = { actorMoved: ['targetActorId'], skillActivated: ['animationIntent'] };
const INTENT_KEYS: Record<string, readonly string[]> = { basicAttack: ['contractVersion', 'encounterId', 'kind', 'targetActorId'], useSkill: ['contractVersion', 'encounterId', 'kind', 'skillId', 'targetActorId'], useItem: ['contractVersion', 'encounterId', 'kind', 'itemId', 'targetActorId'], selectTarget: ['contractVersion', 'encounterId', 'kind', 'targetActorId'], inspect: ['contractVersion', 'encounterId', 'kind', 'targetActorId'], defend: ['contractVersion', 'encounterId', 'kind'], withdraw: ['contractVersion', 'encounterId', 'kind'] };
const OPTIONAL_INTENT_KEYS: Record<string, readonly string[]> = { useSkill: ['targetActorId'], useItem: ['targetActorId'] };

function eventEnvelope(value: WireRecord): PresentationDecodeResult<{ contractVersion: 1; encounterId: string; eventId: string; sequence: number }> { const encounter = text(value['encounterId']); const eventId = text(value['eventId']); const sequence = integer(value['sequence'], 1); return encounter.ok && eventId.ok && sequence.ok ? ok({ contractVersion: PRESENTATION_CONTRACT_VERSION, encounterId: encounter.value, eventId: eventId.value, sequence: sequence.value }) : invalid('event envelope'); }
function exact(input: unknown, keys: readonly string[], optional: readonly string[] = []): PresentationDecodeResult<WireRecord> { if (!record(input)) return fail('invalidShape', 'expected object'); const allowed = new Set(keys); const extra = Object.keys(input).find((key) => !allowed.has(key)); if (extra !== undefined) return fail('unknownField', `unknown field: ${extra}`); const optionalSet = new Set(optional); const missing = keys.find((key) => !optionalSet.has(key) && !Object.hasOwn(input, key)); return missing === undefined ? ok(input) : fail('invalidShape', `missing field: ${missing}`); }
function versionV1(value: unknown): PresentationDecodeResult<1> { return value === 1 ? ok(1) : fail('unsupportedVersion', 'only presentation V1 is supported'); }
function actor(value: unknown): PresentationDecodeResult<PresentationActorId> { return typeof value === 'string' && ACTOR_SELECTOR.test(value) ? ok(value as PresentationActorId) : invalid('actor selector'); }
function nullableActor(value: unknown): PresentationDecodeResult<PresentationActorId | null> { return value === null ? ok(null) : actor(value); }
function optionalActor(value: WireRecord, key: string): PresentationDecodeResult<PresentationActorId | undefined> { return !Object.hasOwn(value, key) ? ok(undefined) : actor(value[key]); }
function text(value: unknown): PresentationDecodeResult<string> { return typeof value === 'string' && value.length > 0 ? ok(value) : invalid('text'); }
function optionalText(value: WireRecord, key: string): PresentationDecodeResult<string | undefined> { return !Object.hasOwn(value, key) ? ok(undefined) : text(value[key]); }
function finite(value: unknown): PresentationDecodeResult<number> { return typeof value === 'number' && Number.isFinite(value) ? ok(value) : invalid('number'); }
function integer(value: unknown, minimum: number): PresentationDecodeResult<number> { return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum ? ok(value) : invalid('integer'); }
function optionalInteger(value: WireRecord, key: string): PresentationDecodeResult<number | undefined> { return !Object.hasOwn(value, key) ? ok(undefined) : integer(value[key], 0); }
function oneOf<const T extends readonly string[]>(value: unknown, values: T): PresentationDecodeResult<T[number]> { return typeof value === 'string' && values.includes(value) ? ok(value as T[number]) : invalid('enum'); }
function nullableOneOf<const T extends readonly string[]>(value: unknown, values: T): PresentationDecodeResult<T[number] | null> { return value === null ? ok(null) : oneOf(value, values); }
function array<T>(value: unknown, decoder: (item: unknown) => PresentationDecodeResult<T>): PresentationDecodeResult<readonly T[]> { if (!Array.isArray(value)) return invalid('array'); const result: T[] = []; for (const item of value) { const decoded = decoder(item); if (!decoded.ok) return decoded; result.push(decoded.value); } return ok(result); }
function record(value: unknown): value is WireRecord { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function ok<T>(value: T): PresentationDecodeResult<T> { return { ok: true, value }; }
function fail(reason: PresentationDecodeFailureReason, message: string): PresentationDecodeResult<never> { return { ok: false, reason, message }; }
function invalid(label: string): PresentationDecodeResult<never> { return fail('invalidShape', `invalid ${label}`); }
function freeze<T>(value: T): T { if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) { for (const nested of Object.values(value as Record<string, unknown>)) freeze(nested); Object.freeze(value); } return value; }
