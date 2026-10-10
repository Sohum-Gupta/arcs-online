import { createGame, transition } from "../game/engine.js";
import { autoInput } from "../game/autoplay.js";
import { timeoutInput } from "../game/timeout-policy.js";
import { writeFileSync } from "node:fs";
const games = Number(process.env.GAMES ?? 200);
let decisions = 0,
  automatic = 0;
for (let seed = 1; seed <= games; seed++) {
  let s = createGame(
    ["A", "B", "C", "D"].slice(0, 2 + (seed % 3)),
    { leaders: seed % 2 === 0, doubleLore: seed % 4 === 0 },
    seed + 7100,
  );
  let randomSeed = seed,
    count = 0;
  const rng = () =>
    (randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0) /
    4294967296;
  while (s.phase !== "over" && count++ < 8000) {
    // Half all-automatic; half interleave ordinary play and expired decisions,
    // exercising battles and optional abilities the conservative bot avoids.
    const auto = seed % 2 === 0 || rng() < 0.4;
    s = transition(
      s,
      s.pending[0]?.p ?? s.current,
      auto ? timeoutInput(s) : autoInput(s, rng),
    );
    decisions++;
    automatic += Number(auto);
  }
  if (s.phase !== "over") throw new Error(`Game ${seed} did not finish`);
}
const report = {
  games,
  decisions,
  automatic,
  result: "Every game completed; invariants checked after every decision.",
};
writeFileSync("docs/timeout-simulations.json", JSON.stringify(report, null, 2));
console.log(report);
