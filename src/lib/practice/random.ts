// Small helpers for picking random content. Pure functions, easy to test.

export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DAY_MS = 86_400_000;

/** How "old" a thing is for the student: -1 = never seen, otherwise the day it was last seen. */
export function seenLevel(lastSeenMs: number | undefined): number {
  return lastSeenMs === undefined ? -1 : Math.floor(lastSeenMs / DAY_MS);
}

/**
 * Random order, but things the student has not seen come first, then the ones
 * seen longest ago. Things seen on the same day count as equal (kept in random
 * order), so every new round is mixed again. With no history this is a plain shuffle.
 */
export function freshFirst<T>(
  items: readonly T[],
  lastSeen: (item: T) => number | undefined,
  rand: () => number = Math.random,
): T[] {
  return shuffle(items, rand)
    .map((item) => ({ item, level: seenLevel(lastSeen(item)) }))
    .sort((a, b) => a.level - b.level) // stable: equal levels keep their random order
    .map((x) => x.item);
}

/**
 * Take `count` items from the groups (topics), at most `perTopic` from each,
 * like a real examiner moving from topic to topic. Groups and items are used
 * in the order given.
 *
 * `level` (see seenLevel) makes it fair over time: first only never-seen
 * items are taken, then items seen longest ago, and so on, so a topic never
 * fills its places with recently asked questions while older ones are left.
 * The result keeps each topic's questions together.
 */
export function pickAcrossTopics<T>(
  groups: { topic: string; items: T[] }[],
  count: number,
  perTopic: number,
  level: (item: T) => number = () => 0,
): { topic: string; item: T }[] {
  const levels = [...new Set(groups.flatMap((g) => g.items.map(level)))].sort((a, b) => a - b);
  const taken = groups.map(() => [] as T[]);
  let total = 0;
  for (const max of levels) {
    groups.forEach((g, gi) => {
      for (const item of g.items) {
        if (total >= count || taken[gi].length >= perTopic) return;
        if (level(item) > max || taken[gi].includes(item)) continue;
        taken[gi].push(item);
        total++;
      }
    });
    if (total >= count) break;
  }
  return groups.flatMap((g, gi) => taken[gi].map((item) => ({ topic: g.topic, item })));
}
