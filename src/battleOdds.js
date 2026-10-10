import { DICE } from "../game/data.js";
export const OUTCOMES = {
  hit: { icon: "✹", label: "Ship hits" },
  building: { icon: "△", label: "Building hits" },
  key: { icon: "⚿", label: "Raid keys" },
  self: { icon: "×", label: "Self hits" },
  intercept: { icon: "↩", label: "Intercept symbols" },
};
export const percent = (n) => `${Math.round(n * 1000) / 10}%`;
export function dieStats(type, symbol) {
  const counts = DICE[type].map(
    (face) => face.filter((s) => s === symbol).length,
  );
  return {
    chance: counts.filter((n) => n > 0).length / 6,
    expected: counts.reduce((a, b) => a + b, 0) / 6,
    max: Math.max(...counts),
  };
}
export function poolStats(pool) {
  return Object.fromEntries(
    Object.keys(OUTCOMES).map((symbol) => {
      let zero = 1,
        expected = 0,
        max = 0;
      for (const type of Object.keys(DICE)) {
        const n = Math.max(0, Math.min(6, Math.floor(Number(pool[type]) || 0))),
          stats = dieStats(type, symbol);
        zero *= Math.pow(1 - stats.chance, n);
        expected += stats.expected * n;
        max += stats.max * n;
      }
      return [symbol, { chance: 1 - zero, expected, max }];
    }),
  );
}
