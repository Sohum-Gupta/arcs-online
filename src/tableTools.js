import { useEffect, useRef } from "react";

// Progressive enhancement for browsers implementing the imperative WebMCP API.
// This adapter sees only the same per-seat projection as the React interface.
export function useTableTools(game, live, act, room) {
  const current = useRef({ game, live, act, room });
  current.current = { game, live, act, room };
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const read = () => {
      const { game, live, room } = current.current;
      if (!live) return { status: "no_active_game" };
      const {
        revision,
        phase,
        chapter,
        round,
        me,
        initiative,
        current: actor,
        decision,
        players,
        pieces,
        court,
        markers,
        supply,
        controls,
        draft,
      } = game;
      return {
        revision,
        phase,
        chapter,
        round,
        me,
        initiative,
        actor,
        decision,
        players,
        pieces,
        court,
        markers,
        supply,
        controls,
        draft,
        turn: game.turn,
        activity: game.activity,
        interaction: game.interaction,
        history: room?.history,
        clock: room?.clock,
        stage:
          game.phase === "card"
            ? "play_card"
            : game.turn?.prelude
              ? "prelude"
              : "actions",
      };
    };
    const definitions = [
      {
        name: "read_arcs_table",
        title: "Read your Arcs table",
        description:
          "Read the current table, your private hand, public board and cards, and your currently legal decisions. Does not expose rival hands.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          if (!input || typeof input !== "object" || Object.keys(input).length)
            throw new Error("This tool takes an empty object.");
          return read();
        },
      },
      {
        name: "submit_arcs_decision",
        title: "Submit an Arcs decision",
        description:
          "Complete one currently legal game decision at the stated revision. This plays cards, moves pieces, resolves effects or ends turns exactly as the visible command panel does. Read the table first; send choice for a numbered option or value for the presented selection form.",
        inputSchema: {
          type: "object",
          properties: {
            revision: { type: "integer", minimum: 0 },
            choice: { type: "integer", minimum: 0 },
            value: {
              oneOf: [
                { type: "array", items: { type: "string" }, uniqueItems: true },
                {
                  type: "object",
                  properties: {
                    skirmish: { type: "integer", minimum: 0, maximum: 6 },
                    assault: { type: "integer", minimum: 0, maximum: 6 },
                    raid: { type: "integer", minimum: 0, maximum: 6 },
                  },
                  required: ["skirmish", "assault", "raid"],
                  additionalProperties: false,
                },
              ],
            },
          },
          required: ["revision"],
          oneOf: [
            { required: ["choice"], not: { required: ["value"] } },
            { required: ["value"], not: { required: ["choice"] } },
          ],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        async execute(input) {
          if (
            !input ||
            typeof input !== "object" ||
            !Number.isInteger(input.revision) ||
            input.revision < 0 ||
            Object.keys(input).some(
              (k) => !["revision", "choice", "value"].includes(k),
            ) ||
            "choice" in input === "value" in input
          )
            throw new Error(
              "Provide a revision and exactly one choice or selection value.",
            );
          const { game, live, act, room } = current.current;
          if (!live || input.revision !== game.revision)
            throw new Error(
              "Read the current table before submitting a decision.",
            );
          if (
            "choice" in input &&
            (!Number.isInteger(input.choice) || input.choice < 0)
          )
            throw new Error("Choice must be a nonnegative integer.");
          const result = await act(input);
          if (!result?.ok)
            throw new Error(result?.error ?? "Another command is in progress.");
          await new Promise((resolve) => requestAnimationFrame(resolve));
          return { ...result, decision: current.current.game.decision };
        },
      },
    ];
    for (const tool of definitions) {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Unsupported/partial implementations leave ordinary play unchanged. */
      }
    }
    return () => lifecycle.abort();
  }, []);
}
