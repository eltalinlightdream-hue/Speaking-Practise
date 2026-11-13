// Small helpers for picking random content. Pure functions, easy to test.

export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Take `count` questions by walking through topics in random order, a few
 * questions per topic, like a real examiner moving from topic to topic.
 */
export function pickAcrossTopics<T>(
  groups: { topic: string; items: T[] }[],
  count: number,
  perTopic: number,
  rand: () => number = Math.random,
): { topic: string; item: T }[] {
  const out: { topic: string; item: T }[] = [];
  for (const g of shuffle(groups.filter((x) => x.items.length > 0), rand)) {
    for (const item of shuffle(g.items, rand).slice(0, perTopic)) {
      if (out.length >= count) return out;
      out.push({ topic: g.topic, item });
    }
  }
  return out;
}
