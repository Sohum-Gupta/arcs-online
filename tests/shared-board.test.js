import test from "node:test";
import assert from "node:assert/strict";
import { ambitionStanding } from "../src/sharedBoard.js";
import { createGame, viewFor, scoreAmbition } from "../game/engine.js";
import { AMBITIONS } from "../game/data.js";
test("shared ambition standing includes neutral wins, tied leaders and zero values", () => {
  const game = {
    players: [{ name: "A" }, { name: "B" }],
    markers: [{ id: 0, ambition: "tycoon", high: 5, low: 2 }],
    ambitionValues: { tycoon: [3, 1] },
    neutral: { tycoon: 4 },
  };
  assert.equal(ambitionStanding(game, "tycoon").leaders[0].name, "Neutral");
  game.neutral.tycoon = 3;
  assert.equal(ambitionStanding(game, "tycoon").tied, true);
  game.neutral.tycoon = 0;
  game.ambitionValues.tycoon = [0, 0];
  assert.equal(ambitionStanding(game, "tycoon").leaders.length, 0);
  assert.equal(ambitionStanding(game, "tycoon").markers.length, 1);
});
test("public scoring preview uses authoritative scoring including Leader penalties", () => {
  const game = createGame(["A", "B", "C"], {}, 94);
  game.players[0].leader = "LEAD12";
  for (const ambition of AMBITIONS) {
    game.markers[0].ambition = ambition;
    const view = viewFor(game, 0);
    assert.deepEqual(
      view.ambitionAwards[ambition],
      scoreAmbition(game, ambition),
    );
    assert.equal(view.rng, undefined);
    assert.equal(typeof view.players[1].hand, "number");
  }
});
