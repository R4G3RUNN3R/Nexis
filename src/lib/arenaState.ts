export const ARENA_STORAGE_KEY_PREFIX = "nexis_arena_state";

export function getArenaStateKey(playerId: string) {
  return `${ARENA_STORAGE_KEY_PREFIX}:${playerId}`;
}
