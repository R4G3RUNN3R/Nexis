import { type WorldCity } from "./worldMapData";

export interface CityDestination {
  id: string;
  name: string;
  route: string;
  description: string;
  icon?: string;
  locked?: boolean;
  lockReason?: string;
  image?: string;
}

export interface CityDistrict {
  id: string;
  name: string;
  summary: string;
  image?: string;
  destinations: CityDestination[];
}

const NEXIS_CITY_DISTRICTS: CityDistrict[] = [
  {
    id: "academic",
    name: "Academic District",
    summary: "Learning, archives, and the kind of silence that judges you.",
    image: "/images/districts/academic-district.png",
    destinations: [
      {
        id: "academy",
        name: "Academy",
        route: "/education",
        icon: "A",
        description: "Core education, specialist studies, and long-term progression.",
      },
      {
        id: "salvage_yard",
        name: "Salvage Yard",
        route: "/salvage-yard",
        icon: "S",
        description: "Spend 5 energy searching discarded junk for a minor item and the occasional lucky haul.",
      },
      {
        id: "archives",
        name: "Archives",
        route: "/city-board",
        icon: "R",
        description: "Records, lore, city history, and administrative notices.",
      },
    ],
  },
  {
    id: "commercial",
    name: "Commercial District",
    summary: "Money, goods, and people pretending prices are morally neutral.",
    image: "/images/districts/commercial-district.png",
    destinations: [
      {
        id: "market",
        name: "Market",
        route: "/market",
        icon: "M",
        description: "Primary legal trade hub for goods and commerce.",
      },
      {
        id: "bank",
        name: "Bank",
        route: "/bank",
        icon: "B",
        description: "Deposits, reserves, and future financial systems.",
      },
      {
        id: "black_market",
        name: "Black Market",
        route: "/black-market",
        icon: "BM",
        description: "Restricted trade for players who unlock shady access later.",
        locked: true,
        lockReason: "Requires Shadowcraft or black market access unlocks.",
      },
    ],
  },
  {
    id: "civic",
    name: "Civic District",
    summary: "Administration, law, healing, and institutional disappointment.",
    image: "/images/districts/civic-district.png",
    destinations: [
      {
        id: "city_board",
        name: "City Board",
        route: "/city-board",
        icon: "CB",
        description: "The Nexis public board for jobs, notices, and opportunities.",
      },
      {
        id: "civic_jobs",
        name: "Civic Jobs",
        route: "/civic-jobs",
        icon: "CJ",
        description: "Structured civic employment with ranks, requirements, and daily gains.",
      },
      {
        id: "hospital",
        name: "Hospital",
        route: "/hospital",
        icon: "H",
        description: "Recovery, treatment, and medical support.",
      },
      {
        id: "jail",
        name: "Jail",
        route: "/hospital",
        icon: "J",
        description: "Detention, penalties, busting, and inmate tracking.",
      },
    ],
  },
  {
    id: "adventure",
    name: "Adventure District",
    summary: "Risk, violence, contracts, and generally poor survival planning.",
    image: "/images/districts/adventure-district.png",
    destinations: [
      {
        id: "adventure_board",
        name: "Adventure",
        route: "/adventure",
        icon: "Q",
        description: "Contracts, expeditions, and active adventure content.",
      },
      {
        id: "arena",
        name: "Arena",
        route: "/arena",
        icon: "AR",
        description: "Combat training, stat growth, and future ranking hooks.",
      },
      {
        id: "tavern",
        name: "Tavern",
        route: "/tavern",
        icon: "T",
        description: "Rumors, casual hooks, and future social contract leads.",
      },
    ],
  },
  {
    id: "faction",
    name: "Faction District",
    summary: "Power blocs, group identity, and cooperation until the loot appears.",
    image: "/images/districts/faction-district.png",
    destinations: [
      {
        id: "guilds",
        name: "Guilds",
        route: "/guilds",
        icon: "G",
        description: "Faction-style cooperative groups, raids, and progression.",
      },
      {
        id: "consortiums",
        name: "Consortiums",
        route: "/consortiums",
        icon: "C",
        description: "Economic organizations, employees, and vault growth.",
      },
    ],
  },
  {
    id: "residential",
    name: "Residential District",
    summary: "Properties, comfort, security, and expensive ways to sleep better.",
    image: "/images/districts/residential-district.png",
    destinations: [
      {
        id: "housing",
        name: "Housing",
        route: "/housing",
        icon: "HS",
        description: "Property ownership, upgrades, upkeep, and household effects.",
      },
      {
        id: "travel",
        name: "Travel Gate",
        route: "/travel",
        icon: "TG",
        description: "Depart the city, reach new regions, or get lost like a champion.",
      },
    ],
  },
];

function makeRemoteCityDistricts(city: WorldCity): CityDistrict[] {
  return [
    {
      id: "academic",
      name: "Academy Quarter",
      summary: `${city.name} centers its learning around ${city.academy ?? "the local academy"}.`,
      destinations: [
        {
          id: `${city.id}_academy`,
          name: city.academy ?? "Local Academy",
          route: "/education",
          icon: "A",
          description: `Access study and specialist lessons aligned with ${city.name}.`,
        },
        {
          id: `${city.id}_archives`,
          name: "Public Records",
          route: "/city-board",
          icon: "R",
          description: `Review notices, local briefs, and administrative news from ${city.name}.`,
        },
      ],
    },
    {
      id: "civic",
      name: "Civic Quarter",
      summary: `Law, healing, and public administration for travelers currently based in ${city.name}.`,
      destinations: [
        {
          id: `${city.id}_board`,
          name: "City Board",
          route: "/city-board",
          icon: "CB",
          description: `Open the public notices and contracts available from ${city.name}.`,
        },
        {
          id: `${city.id}_civic_jobs`,
          name: "Civic Jobs",
          route: "/civic-jobs",
          icon: "CJ",
          description: "Review civic employment tracks and active postings.",
        },
        {
          id: `${city.id}_hospital`,
          name: "Hospital",
          route: "/hospital",
          icon: "H",
          description: "Recovery, treatment, and detention status.",
        },
      ],
    },
    {
      id: "venture",
      name: "Field Quarter",
      summary: `Training halls, contracts, and fieldwork routes branching out from ${city.name}.`,
      destinations: [
        {
          id: `${city.id}_adventure`,
          name: "Adventure",
          route: "/adventure",
          icon: "Q",
          description: "Take jobs, expeditions, and city-adjacent contracts.",
        },
        {
          id: `${city.id}_arena`,
          name: "Arena",
          route: "/arena",
          icon: "AR",
          description: "Train battle stats and sharpen combat fundamentals.",
        },
      ],
    },
    {
      id: "residential",
      name: "Traveler Services",
      summary: "Housing access, faction management, and departure routes while away from Nexis.",
      destinations: [
        {
          id: `${city.id}_housing`,
          name: "Housing",
          route: "/housing",
          icon: "HS",
          description: "Review your residence and installed upgrades.",
        },
        {
          id: `${city.id}_guilds`,
          name: "Guilds",
          route: "/guilds",
          icon: "G",
          description: "Manage your guild affiliations and board.",
        },
        {
          id: `${city.id}_consortiums`,
          name: "Consortiums",
          route: "/consortiums",
          icon: "C",
          description: "Manage your player company and business board.",
        },
        {
          id: `${city.id}_travel`,
          name: "Travel Gate",
          route: "/travel",
          icon: "TG",
          description: "Leave the city or plan your next route.",
        },
      ],
    },
  ];
}

export function getCityDistricts(city: WorldCity): CityDistrict[] {
  if (city.id === "nexis") return NEXIS_CITY_DISTRICTS;
  return makeRemoteCityDistricts(city);
}
