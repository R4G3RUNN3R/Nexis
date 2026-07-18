// Ticket A: any mutation that needs to lock two player rows in the same
// transaction (duel resolution, item transfer, guild-quest payouts, etc.)
// must always acquire those locks in the same deterministic order, or two
// transactions locking the same pair of players in opposite order can
// deadlock (Tx1 holds A, wants B; Tx2 holds B, wants A). Internal ids are
// opaque strings (e.g. "usr_<uuid>"), so a plain lexicographic sort gives a
// stable, canonical order without needing to know anything about either
// player.

export function orderInternalIds(idA, idB) {
  return String(idA) <= String(idB) ? [idA, idB] : [idB, idA];
}

// Runs fn(firstId, secondId) where firstId/secondId are idA/idB reordered
// canonically - use this at call sites that need to lock-then-read both
// rows in order, e.g.:
//   const [firstState, secondState] = await lockPlayersInOrder(idA, idB, (id) => findPlayerStateByUserInternalId(client, id, { forUpdate: true }));
export async function lockPlayersInOrder(idA, idB, lockFn) {
  const [firstId, secondId] = orderInternalIds(idA, idB);
  const first = await lockFn(firstId);
  const second = await lockFn(secondId);
  return firstId === idA ? [first, second] : [second, first];
}
