import type { Player } from "./types";

// Random pair generator that tries to balance team skill totals.
export function randomBalancedTeams(players: Player[]): {
  teamA: [Player, Player];
  teamB: [Player, Player];
} | null {
  if (players.length < 4) return null;
  const pool = [...players].sort(() => Math.random() - 0.5).slice(0, 4);
  // Try the 3 unique partitions and pick the one with smallest skill diff
  const [p0, p1, p2, p3] = pool;
  const opts: Array<{ a: [Player, Player]; b: [Player, Player] }> = [
    { a: [p0, p1], b: [p2, p3] },
    { a: [p0, p2], b: [p1, p3] },
    { a: [p0, p3], b: [p1, p2] },
  ];
  const scored = opts.map((o) => ({
    o,
    diff: Math.abs(o.a[0].skill_level + o.a[1].skill_level - (o.b[0].skill_level + o.b[1].skill_level)),
  }));
  scored.sort((x, y) => x.diff - y.diff);
  return { teamA: scored[0].o.a, teamB: scored[0].o.b };
}
