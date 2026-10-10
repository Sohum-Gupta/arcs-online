import test from "node:test";
import assert from "node:assert/strict";
import { dieStats, poolStats } from "../src/battleOdds.js";
import { createGame, decision, transition } from "../game/engine.js";
test("battle probabilities count symbols separately from hits and handle blank pools", () => {
  assert.deepEqual(dieStats("skirmish", "hit"), {
    chance: 0.5,
    expected: 0.5,
    max: 1,
  });
  assert.equal(dieStats("assault", "hit").chance, 5 / 6);
  assert.equal(dieStats("assault", "hit").expected, 7 / 6);
  assert.equal(dieStats("raid", "key").chance, 0.5);
  assert.equal(dieStats("raid", "key").expected, 4 / 6);
  const p = poolStats({ skirmish: 2, assault: 1, raid: 1 });
  assert.ok(Math.abs(p.hit.chance - 23 / 24) < 1e-12);
  assert.ok(Math.abs(p.self.chance - 0.75) < 1e-12);
  assert.equal(p.key.chance, 0.5);
  assert.equal(poolStats({}).hit.chance, 0);
});
test("hit feedback distinguishes damage from destruction and identifies its actual system and piece", () => {
  let s = createGame(["A", "B"], { initiative: 0 }, 37);
  const x = s.pieces.find((p) => p.owner === 1 && p.type === "ship");
  for (const type of ["damage", "destroy"]) {
    s.pending = [
      {
        type: "hits",
        p: 0,
        target: 1,
        dealer: 0,
        system: x.system,
        left: 1,
        kind: "hit",
        battle: true,
      },
    ];
    const c = decision(s, 0).choices.find((c) => c.piece === x.id);
    s = transition(s, 0, { choice: c.id });
    const effect = s.log.findLast((e) => e.effect?.piece === x.id).effect;
    assert.equal(effect.type, type);
    assert.equal(effect.system, x.system);
    assert.equal(effect.pieceType, "ship");
  }
  assert.equal(
    s.pieces.some((p) => p.id === x.id),
    false,
  );
});
