import { createGame, transition } from "../game/engine.js";
import { autoInput } from "../game/autoplay.js";
let finished = 0,
  steps = 0;
const count = Number(process.env.GAMES ?? 60);
for (let seed = 1; seed <= count; seed++) {
  let randomSeed = seed * 9187;
  const rng = () => {
    randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
    return randomSeed / 4294967296;
  };
  let s = createGame(
    ["A", "B", "C", "D"].slice(0, 2 + (seed % 3)),
    { leaders: seed % 2 === 0, doubleLore: seed % 4 === 0 },
    seed,
  );
  try {
    for (let n = 0; n < 10000 && s.phase !== "over"; n++) {
      const p = s.pending[0]?.p ?? s.current;
      s = transition(s, p, autoInput(s, rng));
      steps++;
    }
    if (s.phase !== "over") throw new Error("Simulation did not finish");
    finished++;
  } catch (e) {
    console.error(
      "SEED",
      seed,
      "steps",
      steps,
      "phase",
      s.phase,
      "pending",
      JSON.stringify(s.pending),
      "turn",
      s.turn,
      "error",
      e.stack,
    );
    process.exit(1);
  }
}
console.log(JSON.stringify({ finished, steps }));
