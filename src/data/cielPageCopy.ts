export type CielPageCopy = {
  flavor: string;
  ciel: string;
  alt?: string;
};

export const cielPageCopy: Record<string, CielPageCopy> = {
  home: {
    flavor:
      "Welcome to a world that does not care what you intended to become. Only what your choices make of you.",
    ciel:
      "Here you are. Still alive, still ambitious, and hopefully still capable of reading. This is your central overview — progress, direction, opportunity, and the usual collection of things waiting to consume your time.",
    alt: "Everything important begins somewhere. Usually with confusion, poor decisions, and a vague sense of destiny.",
  },
  city: {
    flavor:
      "Nexis stands because thousands work, scheme, trade, train, and endure beneath its walls. Try not to embarrass yourself in public. The city has enough spectacle already.",
    ciel:
      "Welcome to the city hub. Hover, inspect, decide, and then go where your current competence allows. A surprisingly effective system, really — far better than letting everyone wander somewhere lethal immediately.",
    alt: "This is Nexis in practical form: opportunity arranged into buildings, restrictions, and consequences. Very civilized.",
  },
  academy: {
    flavor: "Knowledge sharpens. Discipline hardens. Training reveals. Unfortunately, so do mistakes.",
    ciel:
      "The Academy handles Education access, advancement, and the small but important matter of whether you are cultivating mastery or merely collecting titles.",
    alt: "Training exists to refine potential. Or expose weakness more efficiently. Both outcomes are useful.",
  },
  travel: {
    flavor:
      "Roads, ships, distance, risk. The world is large enough to reward courage and punish carelessness in equal measure.",
    ciel:
      "The Travel Office opens broader movement across the realm. This is where curiosity becomes itinerary, expense, and occasionally regret.",
    alt: "Yes, you may leave the safety of familiar streets. Whether that was wise remains pending.",
  },
  inventory: {
    flavor:
      "What you carry says as much about you as what you pursue. Preparation has saved more lives than pride ever did.",
    ciel:
      "Your inventory: tools, gear, resources, and the occasional object you forgot you picked up three disasters ago. Keep it organized. Chaos is only charming from a distance.",
  },
  market: {
    flavor:
      "Every coin has a story. Some were earned. Some were extracted. Some were bought with better lies than steel.",
    ciel:
      "Welcome to trade: where value is fluid, patience is profitable, and desperation has an exchange rate. Buy carefully. Sell intelligently. Try not to finance your own future problems.",
  },
};

export const cielCityCopy: Record<string, CielPageCopy> = {
  nexis: {
    flavor: "The capital does not sleep. It calculates. Every guild, profession, and ambition eventually passes through Nexis.",
    ciel:
      "Nexis is the beating heart of the realm: mercantile, crowded, ambitious, and never short on people convinced they are destined for importance.",
    alt: "If the realm has a pulse, it is probably taxed here.",
  },
  north: {
    flavor: "Silver trees. Old magic. Air that hums with memory. Aethermoor would be beautiful if it were not also quietly judging everyone.",
    ciel:
      "Aethermoor specializes in arcane craft, rune-work, and artifact binding. Elegant, dangerous, and predictably full of people who think precision excuses arrogance.",
    alt: "Try not to touch anything glowing unless invited. Even then, exercise caution.",
  },
  east: {
    flavor: "Torvhal does not admire hesitation. It respects endurance, precision, and the discipline to survive what stronger fools cannot.",
    ciel:
      "Torvhal is a fortress-city of iron, steel, and combat doctrine. Useful, severe, and refreshingly honest about what it is.",
    alt: "If something rings day and night, it is either industry or violence. In Torvhal, often both.",
  },
  south: {
    flavor: "Some power is taken. Some is tended. Embervale remembers the difference.",
    ciel:
      "Embervale is a sacred southern sanctuary where spirit and life remain close to the surface. Quiet places often contain the oldest strength.",
    alt: "Yes, it is beautiful. Do try not to confuse beauty with fragility.",
  },
  west: {
    flavor: "Courts above. Shadows below. Westmarch has perfected the art of pretending those are separate things.",
    ciel:
      "Westmarch is divided between law and shadow, order and quiet leverage. A useful city, if you appreciate honesty disguised as contradiction.",
    alt: "Some cities hide their duplicity. Westmarch simply gave each half an address.",
  },
};

export const cielLoadingQuotes = [
  "Progress is measurable. Worthiness is more difficult.",
  "You are free to choose. The consequences remain equally free.",
  "Ambition is useful. Unexamined ambition is usually expensive.",
  "Most disasters begin with confidence.",
  "Preparation: the boring miracle people appreciate only after surviving.",
  "Power is common. Restraint is rarer.",
  "Efficiency without purpose is just polished emptiness.",
  "You may continue. I assume you will.",
  "Competence is a deeply underrated form of elegance.",
  "The world does not owe you clarity. Fortunately, I do.",
  "History is rarely lost. It is usually buried beneath convenience.",
  "A fragment is not truth. It is only proof that truth once existed whole.",
  "Not all forgotten things are gone.",
  "Some systems endure because they were built too well to die.",
  "The world remembers less than it was made to contain.",
  "Accepted history and accurate history are frequent strangers.",
  "Most people inherit history as story. A few discover it as omission.",
  "Some truths survive by refusing to become convenient.",
  "Success is visible. Worthiness rarely is.",
  "Gold can purchase comfort. It cannot purchase qualification.",
  "Not every profitable choice is a wise one.",
  "Many seek power. Fewer learn what it is for.",
  "The ability to take is not evidence of the right to keep.",
  "You may become powerful without becoming worthy. Many do.",
  "The Crown does not confuse appetite with strength.",
  "What freedom makes of you is rarely flattering.",
  "Being first is impressive. What it means is another matter.",
  "The strongest person in the room is often simply the least interrupted.",
  "Read first. Panic later.",
  "There are easier paths. They rarely lead anywhere worth arriving.",
  "Training reveals what ambition cannot hide.",
  "Discipline is less glamorous than talent and far more reliable.",
  "Mastery is repetition refined by honesty.",
  "Potential is common. Follow-through is rarer.",
  "Skill grows where ego is forced to make room.",
  "Improvement requires effort. Charming, I know.",
  "No academy can rescue a person determined to remain careless.",
  "A title is a label. Competence is harder to fake.",
  "Your training matters. So does why you pursued it.",
  "Markets reward timing, nerve, and other people’s miscalculations.",
  "Trade moves goods openly and influence quietly.",
  "A ledger can ruin lives with remarkable efficiency.",
  "Wealth expands possibility. It does not answer purpose.",
  "Coin is honest only in weight.",
  "Ownership is one of ambition’s more respectable costumes.",
  "Law can shelter. It can also suffocate. Learn the difference.",
  "Shadow is not always evil. Often it is simply unadvertised.",
  "Order and Shadow disagree mainly on presentation.",
  "Some institutions wear uniforms. Others wear discretion.",
  "A clean title does not guarantee clean hands.",
  "You may serve order, shadow, or yourself. The world will notice eventually.",
  "Power shared is more revealing than power seized.",
  "Trust is slower than force and usually more valuable.",
  "Not every bond can be rushed into usefulness.",
  "Ancient things tend to dislike entitlement.",
  "Patience is not passivity. It is controlled timing.",
  "Some forms of strength arrive quietly.",
  "The world permits corruption. That does not mean it rewards it.",
  "You may become feared without becoming fit to lead.",
  "Cruelty is a poor substitute for control.",
  "A person is most visible in what they do when no one compels decency.",
  "The right to rule has been claimed by many and proven by few.",
  "There is a difference between dominance and custodianship. Learn it.",
  "If freedom made you smaller, do not blame freedom.",
  "Some crowns weigh more than those who seek them understand.",
  "To bear power without rotting beneath it is rarer than conquest.",
  "The question was never whether you could rise. It was what rising would make of you.",
] as const;

export const cielTooltips = [
  "Try not to mistake activity for progress.",
  "A surprising number of problems improve when observed carefully.",
  "You can, in fact, survive without clicking everything immediately.",
  "Locked. Growth remains annoyingly dependent on prerequisites.",
  "Unavailable. Reality has boundaries. Try not to take it personally.",
  "No active selection. Indecision is technically a choice, just not a useful one.",
  "You are not cleared for that yet. A tragic blow to your momentum, I’m sure.",
  "This section remains quiet. Enjoy the peace before you ruin it with progress.",
] as const;

export const cielEmptyStates = {
  emptyInventory: "Empty. Either impressively organized or alarmingly unprepared.",
  noActiveQuests: "No active quests. A rare moment of peace, or evidence you have been neglecting opportunity.",
  noJobsSelected: "No job selected. Poverty remains an available path, though I would not recommend specializing in it.",
  noFragmentsFound: "No fragments recovered. History remains intact, smug, and uncooperative.",
  lockedAcademy: "Locked. Growth often insists on prerequisites. Tiresome, but effective.",
  noSpiritBond: "No active bond. Power shared requires trust. Also effort. Mostly effort.",
  lowCurrency: "Resources limited. This would be less concerning if the world accepted optimism as payment.",
  skillUnavailable: "Unavailable. You have either not earned it yet, or reality has chosen boundaries.",
  marketSoldOut: "Unavailable. Someone was faster, luckier, or more desperate.",
  travelLocked: "Not accessible yet. The world is large. Your permissions are not.",
  historyEducationLocked: "You are not yet equipped to interpret what is buried. Ignorance, for once, is structurally enforced.",
} as const;
