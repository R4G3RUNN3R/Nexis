import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESENTATION_PREFERENCES, applyPresentationEvent, decodeBattlePresentationSnapshot, decodePresentationEvent, normalizePresentationPreferences, type BattlePresentationSnapshot, type PresentationEvent, type TheatreViewerMode } from '../src/index.ts';

function snapshot(): BattlePresentationSnapshot {
  const decoded = decodeBattlePresentationSnapshot({ contractVersion: 1, encounterId: 'encounter-1', revision: 7, eventCursor: 0, phase: 'active', roundNumber: 1, activeActorId: 'actor_hero', outcome: null, actors: [
    { actorId: 'actor_hero', displayName: 'Hero', side: 'ally', facing: 'right', visualKey: 'placeholder', resources: [{ resourceId: 'life', displayName: 'Life', current: 100, maximum: 100 }], statuses: [], attachments: [], defeated: false, isLegalTarget: false },
    { actorId: 'actor_foe', displayName: 'Foe', side: 'hostile', facing: 'left', visualKey: 'placeholder', resources: [{ resourceId: 'life', displayName: 'Life', current: 50, maximum: 60 }], statuses: [], attachments: [], defeated: false, isLegalTarget: true },
  ] });
  if (!decoded.ok) throw new Error(decoded.message); return decoded.value;
}
function event(fields: Record<string, unknown>): PresentationEvent { const decoded = decodePresentationEvent({ contractVersion: 1, encounterId: 'encounter-1', eventId: 'evt-1', sequence: 1, ...fields }); if (!decoded.ok) throw new Error(decoded.message); return decoded.value; }

describe('pure authoritative presentation application', () => {
  it('copies resulting values instead of calculating from display amounts', () => {
    const result = applyPresentationEvent(snapshot(), event({ type: 'damageApplied', targetActorId: 'actor_hero', displayAmount: 37, resultingResource: { resourceId: 'life', resultingValue: 55, resultingMaximum: 120 } }));
    expect(result.kind).toBe('applied');
    if (result.kind === 'applied') expect(result.snapshot.actors[0]?.resources[0]).toMatchObject({ current: 55, maximum: 120 });
  });

  it('retains opaque status semantics without hidden identity or caller aliasing', () => {
    const input = { kind: 'opaque', instanceId: 'opaque-1', displayName: 'Unknown Effect' };
    const result = applyPresentationEvent(snapshot(), event({ type: 'statusApplied', actorId: 'actor_foe', status: input }));
    input.displayName = 'mutated';
    expect(result.kind).toBe('applied');
    if (result.kind === 'applied') {
      const status = result.snapshot.actors[1]?.statuses[0];
      expect(status).toEqual({ kind: 'opaque', instanceId: 'opaque-1', displayName: 'Unknown Effect' });
      expect(status).not.toHaveProperty('statusId');
      expect(Object.isFrozen(status)).toBe(true);
    }
  });

  it('advances display-only events without changing other presentation state', () => {
    const before = snapshot(); const result = applyPresentationEvent(before, event({ type: 'combatMessage', message: 'Visible' }));
    expect(result.kind).toBe('applied');
    if (result.kind === 'applied') expect(result.snapshot).toEqual({ ...before, eventCursor: 1 });
  });
});

describe('preferences and viewer vocabulary', () => {
  it('normalizes only presentation preferences', () => {
    expect(normalizePresentationPreferences(undefined)).toEqual(DEFAULT_PRESENTATION_PREFERENCES);
    expect(normalizePresentationPreferences({ reducedMotion: true, presentationSpeed: 100 })).toMatchObject({ reducedMotion: true, presentationSpeed: 4 });
    expect(normalizePresentationPreferences({ presentationSpeed: 0 })).toMatchObject({ presentationSpeed: 0.25 });
  });
  it('keeps shared viewer modes presentation-only', () => {
    const modes: readonly TheatreViewerMode[] = ['live', 'replay', 'spectator']; expect(modes).toHaveLength(3);
  });
});
