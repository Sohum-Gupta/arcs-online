export const ambitionLabels = {
  tycoon: "Material & Fuel icons",
  tyrant: "Captive agents",
  warlord: "Trophies",
  keeper: "Relic icons",
  empath: "Psionic icons",
};
export function ambitionStanding(game, ambition) {
  const values = game.ambitionValues?.[ambition] ?? game.players.map(() => 0);
  const neutral =
    game.players.length === 2 ? (game.neutral?.[ambition] ?? 0) : 0;
  const high = Math.max(0, ...values, neutral);
  const leaders =
    high > 0 ? game.players.filter((_, i) => values[i] === high) : [];
  if (high > 0 && neutral === high)
    leaders.push({ id: "neutral", name: "Neutral", color: "#b8b1a3" });
  return {
    values,
    high,
    leaders,
    tied: leaders.length > 1,
    markers: game.markers.filter((m) => m.ambition === ambition),
  };
}
