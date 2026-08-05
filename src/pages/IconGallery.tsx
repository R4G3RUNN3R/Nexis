// ---------------------------------------------------------------------------
// Nexis - Icon Gallery (dev/reference page)
//
// Renders every icon in src/assets/icons at 16 / 24 / 40 px on the game's
// dark ground so the set can be reviewed for legibility and consistency.
// Routed at /icon-gallery.
// ---------------------------------------------------------------------------

import type { IconComponent } from "../assets/icons";
import {
  // nav
  HomeIcon, ProfileIcon, LifePathsIcon, InventoryIcon, CraftingIcon, EducationIcon,
  SkillsIcon, AdventureIcon, HousingIcon, CityIcon, CivicJobsIcon, TravelIcon,
  WorldMapIcon, CodexIcon, ArenaIcon, CityBoardIcon, SalvageYardIcon, HospitalIcon,
  GuildsIcon, ConsortiumsIcon, AdminIcon,
  // stats
  EnergyIcon, HealthIcon, StaminaIcon, ComfortIcon, NerveIcon, GoldIcon,
  ShadowIcon, LevelIcon, ExperienceIcon,
  // conditions
  ConditionReadyIcon, ConditionHospitalIcon, ConditionJailIcon,
  ConditionTravelingIcon, ConditionCombatIcon,
  // map
  CityPinIcon, CapitalPinIcon, HiddenSiteIcon, RumoredSiteIcon, RouteIcon, DiscoveryIcon,
  // categories
  CategoryCombatIcon, CategoryWeaponsIcon, CategoryEducationIcon, CategoryTravelIcon,
  CategoryDiscoveriesIcon, CategoryEconomyIcon, CategoryCraftingIcon, CategoryOrgIcon,
  CategoryContractsIcon, CategoryTimeIcon, CategoryMiscIcon, HonorIcon, MedalIcon,
  // org
  GuildBannerIcon, ConsortiumSealIcon, TreasuryIcon, ArmoryIcon, QuestIcon,
  DungeonIcon, SkillNodeIcon,
  // vote
  RankedRibbonIcon, RisingRankIcon,
} from "../assets/icons";
import "../styles/iconGallery.css";

type Entry = { name: string; component: string; Icon: IconComponent };
type Section = { title: string; entries: Entry[] };

const SECTIONS: Section[] = [
  {
    title: "Navigation",
    entries: [
      { name: "Home", component: "HomeIcon", Icon: HomeIcon },
      { name: "Profile", component: "ProfileIcon", Icon: ProfileIcon },
      { name: "Life Paths", component: "LifePathsIcon", Icon: LifePathsIcon },
      { name: "Inventory", component: "InventoryIcon", Icon: InventoryIcon },
      { name: "Crafting", component: "CraftingIcon", Icon: CraftingIcon },
      { name: "Education", component: "EducationIcon", Icon: EducationIcon },
      { name: "Skills", component: "SkillsIcon", Icon: SkillsIcon },
      { name: "Adventure", component: "AdventureIcon", Icon: AdventureIcon },
      { name: "Housing", component: "HousingIcon", Icon: HousingIcon },
      { name: "City", component: "CityIcon", Icon: CityIcon },
      { name: "Civic Jobs", component: "CivicJobsIcon", Icon: CivicJobsIcon },
      { name: "Travel", component: "TravelIcon", Icon: TravelIcon },
      { name: "World Map", component: "WorldMapIcon", Icon: WorldMapIcon },
      { name: "Codex", component: "CodexIcon", Icon: CodexIcon },
      { name: "Arena", component: "ArenaIcon", Icon: ArenaIcon },
      { name: "City Board", component: "CityBoardIcon", Icon: CityBoardIcon },
      { name: "Salvage Yard", component: "SalvageYardIcon", Icon: SalvageYardIcon },
      { name: "Hospital", component: "HospitalIcon", Icon: HospitalIcon },
      { name: "Guilds", component: "GuildsIcon", Icon: GuildsIcon },
      { name: "Consortiums", component: "ConsortiumsIcon", Icon: ConsortiumsIcon },
      { name: "Admin", component: "AdminIcon", Icon: AdminIcon },
    ],
  },
  {
    title: "Stats & Resources",
    entries: [
      { name: "Energy", component: "EnergyIcon", Icon: EnergyIcon },
      { name: "Health", component: "HealthIcon", Icon: HealthIcon },
      { name: "Stamina", component: "StaminaIcon", Icon: StaminaIcon },
      { name: "Comfort", component: "ComfortIcon", Icon: ComfortIcon },
      { name: "Nerve", component: "NerveIcon", Icon: NerveIcon },
      { name: "Gold", component: "GoldIcon", Icon: GoldIcon },
      { name: "Shadow", component: "ShadowIcon", Icon: ShadowIcon },
      { name: "Level", component: "LevelIcon", Icon: LevelIcon },
      { name: "Experience", component: "ExperienceIcon", Icon: ExperienceIcon },
    ],
  },
  {
    title: "Conditions",
    entries: [
      { name: "Normal / Ready", component: "ConditionReadyIcon", Icon: ConditionReadyIcon },
      { name: "Hospital", component: "ConditionHospitalIcon", Icon: ConditionHospitalIcon },
      { name: "Jail", component: "ConditionJailIcon", Icon: ConditionJailIcon },
      { name: "Traveling", component: "ConditionTravelingIcon", Icon: ConditionTravelingIcon },
      { name: "In Combat", component: "ConditionCombatIcon", Icon: ConditionCombatIcon },
    ],
  },
  {
    title: "Atlas & Map Markers",
    entries: [
      { name: "City Pin", component: "CityPinIcon", Icon: CityPinIcon },
      { name: "Capital Pin", component: "CapitalPinIcon", Icon: CapitalPinIcon },
      { name: "Hidden Site", component: "HiddenSiteIcon", Icon: HiddenSiteIcon },
      { name: "Rumored Site", component: "RumoredSiteIcon", Icon: RumoredSiteIcon },
      { name: "Route / Corridor", component: "RouteIcon", Icon: RouteIcon },
      { name: "Discovery / Compass", component: "DiscoveryIcon", Icon: DiscoveryIcon },
    ],
  },
  {
    title: "Achievement Categories",
    entries: [
      { name: "Combat", component: "CategoryCombatIcon", Icon: CategoryCombatIcon },
      { name: "Weapons", component: "CategoryWeaponsIcon", Icon: CategoryWeaponsIcon },
      { name: "Education", component: "CategoryEducationIcon", Icon: CategoryEducationIcon },
      { name: "Travel", component: "CategoryTravelIcon", Icon: CategoryTravelIcon },
      { name: "Discoveries", component: "CategoryDiscoveriesIcon", Icon: CategoryDiscoveriesIcon },
      { name: "Economy", component: "CategoryEconomyIcon", Icon: CategoryEconomyIcon },
      { name: "Crafting", component: "CategoryCraftingIcon", Icon: CategoryCraftingIcon },
      { name: "Guild / Consortium", component: "CategoryOrgIcon", Icon: CategoryOrgIcon },
      { name: "Contracts", component: "CategoryContractsIcon", Icon: CategoryContractsIcon },
      { name: "Time", component: "CategoryTimeIcon", Icon: CategoryTimeIcon },
      { name: "Miscellaneous", component: "CategoryMiscIcon", Icon: CategoryMiscIcon },
      { name: "Honor", component: "HonorIcon", Icon: HonorIcon },
      { name: "Medal", component: "MedalIcon", Icon: MedalIcon },
    ],
  },
  {
    title: "Orders & Holdings",
    entries: [
      { name: "Guild Banner", component: "GuildBannerIcon", Icon: GuildBannerIcon },
      { name: "Consortium Seal", component: "ConsortiumSealIcon", Icon: ConsortiumSealIcon },
      { name: "Treasury", component: "TreasuryIcon", Icon: TreasuryIcon },
      { name: "Armory", component: "ArmoryIcon", Icon: ArmoryIcon },
      { name: "Quest", component: "QuestIcon", Icon: QuestIcon },
      { name: "Dungeon", component: "DungeonIcon", Icon: DungeonIcon },
      { name: "Skill Node", component: "SkillNodeIcon", Icon: SkillNodeIcon },
    ],
  },
  {
    title: "External Links",
    entries: [
      { name: "Ranked Ribbon", component: "RankedRibbonIcon", Icon: RankedRibbonIcon },
      { name: "Rising Rank", component: "RisingRankIcon", Icon: RisingRankIcon },
    ],
  },
];

const PREVIEW_SIZES = [16, 24, 40] as const;

export default function IconGalleryPage() {
  const total = SECTIONS.reduce((sum, section) => sum + section.entries.length, 0);

  return (
    <div className="icon-gallery">
      <header className="icon-gallery__header">
        <h1>Nexis Icon Library</h1>
        <p>
          {total} original hand-authored glyphs (src/assets/icons). Stroke = currentColor, accent
          defaults to amber #d89a47, 24x24 viewBox, default size 20. Each icon is shown at 16 / 24 / 40 px.
        </p>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.title} className="icon-gallery__section">
          <h2>{section.title}</h2>
          <div className="icon-gallery__grid">
            {section.entries.map(({ name, component, Icon }) => (
              <div key={component} className="icon-tile">
                <div className="icon-tile__sizes">
                  {PREVIEW_SIZES.map((size) => (
                    <span key={size} className="icon-tile__size">
                      <Icon size={size} title={`${name} (${size}px)`} />
                      <small>{size}</small>
                    </span>
                  ))}
                </div>
                <span className="icon-tile__name">{name}</span>
                <span className="icon-tile__key">{component}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
