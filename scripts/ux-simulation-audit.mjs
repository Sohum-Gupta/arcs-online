import { createGame, decision, transition, viewFor } from "../game/engine.js";
import { autoInput } from "../game/autoplay.js";
import { writeFileSync, mkdirSync } from "node:fs";
const count = Number(process.env.GAMES ?? 240),
  output = process.env.AUDIT_DIR ?? "work/ux-simulation";
mkdirSync(output, { recursive: true });
const states = {},
  fixtures = {},
  leaders = new Set(),
  cards = new Set();
let steps = 0,
  maxChoices = 0;
for (let seed = 1; seed <= count; seed++) {
  let randomSeed = seed * 9187;
  const rng = () =>
    (randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0) /
    4294967296;
  let s = createGame(
    ["A", "B", "C", "D"].slice(0, 2 + (seed % 3)),
    { leaders: seed % 2 === 0, doubleLore: seed % 4 === 0 },
    seed,
  );
  for (let n = 0; n < 10000 && s.phase !== "over"; n++) {
    const p = s.pending[0]?.p ?? s.current,
      t = s.pending[0],
      d = decision(s, p),
      key =
        t?.type ??
        (s.phase === "turn"
          ? s.turn.prelude
            ? "preludeRoot"
            : "actionsRoot"
          : s.phase);
    states[key] = (states[key] ?? 0) + 1;
    maxChoices = Math.max(maxChoices, d.choices.length);
    if (
      !fixtures[key] ||
      d.choices.length > fixtures[key].game.decision.choices.length
    )
      fixtures[key] = { seed, game: viewFor(s, p), raw: s };
    for (const pl of s.players) {
      if (pl.leader) leaders.add(pl.leader);
      for (const c of pl.cards) cards.add(c);
    }
    for (const c of d.choices) if (c.card) cards.add(c.card);
    try {
      s = transition(s, p, autoInput(s, rng));
    } catch (e) {
      writeFileSync(
        `${output}/failure.json`,
        JSON.stringify({ seed, state: s, error: e.stack }),
      );
      throw e;
    }
    steps++;
  }
  if (s.phase !== "over") throw new Error(`Seed ${seed} failed to finish`);
  states.over = (states.over ?? 0) + 1;
  fixtures.over ??= { seed, game: viewFor(s, 0), raw: s };
}
const report = {
  games: count,
  steps,
  maxChoices,
  states,
  leaders: [...leaders].sort(),
  cards: [...cards].sort(),
};
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2));
writeFileSync(`${output}/fixtures.json`, JSON.stringify(fixtures));
console.log(JSON.stringify(report));
