import test from "node:test";
import assert from "node:assert/strict";
import { createGame, decision, transition, viewFor } from "../game/engine.js";
import {
  applyResourceArrangement,
  historyView,
  travelHistory,
} from "../server/history.js";
const setResources = (game, order) => {
  for (const r of game.players[0].resources) if (r) game.supply[r]++;
  game.players[0].resources = order;
  for (const r of order) if (r) game.supply[r]--;
};
const fixture = () => {
  const game = createGame(["Pilot", "Rival", "Third"], { initiative: 0 }, 3);
  setResources(game, ["fuel", "relic", null]);
  game.pending = [{ type: "arrangeResources", p: 0 }];
  return { game };
};
test("resource tray commits permutations atomically and undo/redo restores the full arrangement window", () => {
  for (const order of [
    ["fuel", "relic", null],
    ["fuel", null, "relic"],
    ["relic", "fuel", null],
    ["relic", null, "fuel"],
    [null, "fuel", "relic"],
    [null, "relic", "fuel"],
  ]) {
    const room = fixture(),
      before = structuredClone(room.game);
    applyResourceArrangement(room, 0, { resourceArrangement: order });
    assert.deepEqual(room.game.players[0].resources, order);
    assert.equal(
      room.game.pending.some((t) => t.type === "arrangeResources"),
      false,
    );
    assert.equal(historyView(room, 0).steps.length, 1);
    travelHistory(room, 0, "undo");
    assert.deepEqual(
      room.game.players[0].resources,
      before.players[0].resources,
    );
    assert.deepEqual(room.game.pending, before.pending);
    travelHistory(room, 0, "redo");
    assert.deepEqual(room.game.players[0].resources, order);
  }
});
test("invalid resource arrangements and wrong actors never partially mutate saved state", () => {
  for (const input of [
    null,
    [],
    ["fuel", "fuel", null],
    ["weapon", "relic", null],
    ["fuel", "relic", null, null],
  ]) {
    const room = fixture(),
      snapshot = JSON.stringify(room);
    assert.throws(() =>
      applyResourceArrangement(room, 0, { resourceArrangement: input }),
    );
    assert.equal(JSON.stringify(room), snapshot);
  }
  const room = fixture(),
    snapshot = JSON.stringify(room);
  assert.throws(() =>
    applyResourceArrangement(room, 1, {
      resourceArrangement: ["fuel", "relic", null],
    }),
  );
  assert.equal(JSON.stringify(room), snapshot);
  room.game.pending = [];
  assert.throws(() =>
    applyResourceArrangement(room, 0, {
      resourceArrangement: ["fuel", "relic", null],
    }),
  );
});
test("resource tray resumes old slot-picker saves and only exposes controls to the actor", () => {
  const room = fixture();
  room.game = transition(room.game, 0, {
    choice: decision(room.game, 0).choices.find(
      (c) => c.op === "arrangePick" && c.index === 1,
    ).id,
  });
  assert.equal(viewFor(room.game, 0).resourceArrangement.selected, 1);
  assert.equal(viewFor(room.game, 1).resourceArrangement, null);
  applyResourceArrangement(room, 0, {
    resourceArrangement: [null, "fuel", "relic"],
  });
  assert.deepEqual(room.game.players[0].resources, [null, "fuel", "relic"]);
});
test("identical resource tokens and empty slots preserve all tokens", () => {
  const room = fixture();
  setResources(room.game, ["relic", "relic", null]);
  applyResourceArrangement(room, 0, {
    resourceArrangement: [null, "relic", "relic"],
  });
  assert.deepEqual(room.game.players[0].resources, [null, "relic", "relic"]);
});
