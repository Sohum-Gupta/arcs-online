import { ACTION_CARDS, SUITS } from "../game/data.js";
export const ACTION_HELP = {
  build: {
    title: "Build",
    summary: "Add a ship, city, or starport.",
    detail:
      "A building needs an empty planet slot where you have a piece. A ship is built at your starport. A rival-controlled system makes the new piece arrive damaged. Each starport normally builds only one ship per turn.",
    example:
      "Cities open resource slots and can be taxed. Starports launch ships.",
    page: 12,
  },
  repair: {
    title: "Repair",
    summary: "Restore one damaged piece.",
    detail:
      "Turn one of your damaged ships, cities, or starports back to its fresh side, anywhere on the map.",
    example:
      "A fresh ship counts toward control again and can take a hit before being destroyed.",
    page: 12,
  },
  move: {
    title: "Move",
    summary: "Send a fleet to an adjacent system.",
    detail:
      "Choose any of your ships in one system and move them together. Starting at your fresh starport can allow a longer catapult route through gates not controlled by rivals.",
    example:
      "Select an origin, adjust the fleet if needed, then click its destination.",
    page: 13,
  },
  tax: {
    title: "Tax",
    summary: "Collect a city’s planet resource.",
    detail:
      "Tax your own city, or a rival city in a system you control. Each city can be taxed once per turn. Taxing a rival also captures an available agent from their supply.",
    example: "A city on a fuel planet yields fuel, if the supply has any.",
    page: 12,
  },
  influence: {
    title: "Influence",
    summary: "Place an agent on a Court card.",
    detail:
      "Take one agent from your supply and place it on any card in the Court. This builds your claim; it does not take the card yet.",
    example: "Use Secure once you have more agents there than every rival.",
    page: 12,
  },
  secure: {
    title: "Secure",
    summary: "Claim a Court card with your agents.",
    detail:
      "You need at least one agent and strictly more than each rival on that card. Your agents return to supply; rival agents become your Captives. Guilds join your tableau. Vox cards resolve and are discarded.",
    example: "Two agents beat one; a tie is not enough.",
    page: 12,
  },
  battle: {
    title: "Battle",
    summary: "Attack a rival where you have ships.",
    detail:
      "Choose a rival with pieces in that system, then your dice. Skirmish seeks ship hits; assault trades safety for more hits; raid offers building hits and theft. Roll odds are shown before committing.",
    example: "One hit damages a fresh piece; another destroys a damaged piece.",
    page: 14,
  },
};
export function playPreview(choice, game) {
  const card = ACTION_CARDS[choice.card];
  const suit = choice.mode === "copy" ? game.lead.suit : card.suit;
  const pips = ["lead", "surpass"].includes(choice.mode) ? card.pips : 1;
  const modes = {
    copy: {
      title: "Copy",
      subtitle: "Follow the lead",
      summary: `Face down · use ${suit}`,
      detail: `Spend this card face down to use the lead’s ${suit} suit. You get one card action, regardless of the pips printed on your card. Copy does not compete for initiative.`,
      example: `Here: choose one ${SUITS[suit].join(", ")} action.`,
      page: 10,
    },
    pivot: {
      title: "Pivot",
      subtitle: "Change your approach",
      summary: `Face up · use ${suit}`,
      detail: `Play your ${suit} card face up because its suit differs from the lead. You get one card action, regardless of its printed pips. The lead suit stays unchanged for other players. Pivot does not compete for initiative.`,
      example:
        "Use this when you need your own card’s actions more than the lead’s.",
      page: 10,
    },
    surpass: {
      title: "Surpass",
      subtitle: "Raise the stakes",
      summary: `Face up · ${card.rank} beats ${game.lead?.rank ?? 0}`,
      detail:
        "Match the lead suit and play a higher number than the lead, not necessarily higher than every other played card. Use all your card’s pips. The highest Surpass takes next round’s initiative unless someone seized it.",
      example: `Here: ${pips} ${suit} card actions.`,
      page: 10,
    },
    lead: {
      title: "Lead",
      subtitle: "Set the course",
      summary: `Face up · set ${suit} as the lead`,
      detail:
        "Set the suit and number for this round. Use your card’s printed pips. Before actions, you may declare an eligible ambition if a marker remains; this makes the lead number zero without removing pips.",
      example: `Here: up to ${pips} ${suit} card actions.`,
      page: 8,
    },
  };
  return { suit, pips, actions: SUITS[suit], ...modes[choice.mode] };
}
