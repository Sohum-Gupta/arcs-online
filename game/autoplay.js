import { decision } from "./engine.js";
// Practice rivals are deliberately simple; legal choices come only from the engine.
export function autoInput(s, rng = Math.random) {
  const p = s.pending[0]?.p ?? s.current,
    d = decision(s, p),
    t = s.pending[0];
  if (d.form) {
    const f = d.form;
    if (f.kind === "dice") {
      const dice = { skirmish: 0, assault: 0, raid: 0 },
        total = Math.min(18, f.max);
      for (let i = 0; i < total; i++) {
        const allowed = ["skirmish", "assault", "raid"].filter(
          (k) =>
            dice[k] < (k === "raid" ? f.raidMax : 6) &&
            (!f.corsair || k !== "assault" || dice.assault < dice.skirmish),
        );
        if (!allowed.length) break;
        dice[allowed[Math.floor(rng() * allowed.length)]]++;
      }
      return { value: dice };
    }
    return { value: f.options.slice(0, f.min).map((x) => x.id) };
  }
  let cs = d.choices.filter(
    (c) =>
      !["reorder", "arrangePick", "cancel", "pass", "withoutBonus"].includes(
        c.op,
      ),
  );
  if (s.phase === "turn" && !t) {
    const declares = cs.filter((c) => c.op === "declare"),
      actions = cs.filter((c) => c.op === "action");
    cs = declares.length
      ? declares
      : actions.length
        ? actions
        : cs.filter((c) => c.op === "endTurn");
  }
  if (!cs.length) cs = d.choices;
  if (!cs.length) throw new Error(`No legal choice: ${d.title}`);
  return { choice: cs[Math.floor(rng() * cs.length)].id };
}
