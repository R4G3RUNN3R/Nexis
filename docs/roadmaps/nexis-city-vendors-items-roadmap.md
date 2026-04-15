# Nexis City Vendors, Items, and Enhancement Roadmap

## Purpose
This document is the working plan of action for building Nexis city vendors, item categories, shop structure, enhancement rules, and related progression systems. It is intended to be followed as the roadmap for implementation.

---

## Core Direction
Nexis will not use one giant generic market page. Instead, the city will contain district-based NPC vendors, similar in spirit to Torn's city locations, with distinct identities, stock pools, and progression hooks.

These vendors will function as city nodes, not faceless shop menus.

---

## City Vendor Structure
The following vendors are approved as the initial city shop structure:

- Blacksmith / Armory
- Fletcher / Bowyer
- Leatherworker
- Temple / Faith Supplies
- General Store
- Adventuring Supplies
- Potion Shop
- Arcane Shop
- Jeweler / Stonecutter
- Transportation
- Tattoo Shop

These should exist as city district locations and named NPC vendors.

---

## District Grouping Plan

### Forge Row
- Blacksmith / Armory
- Fletcher / Bowyer
- Leatherworker

### Market Square
- General Store
- Adventuring Supplies
- Jeweler / Stonecutter

### Pilgrim's Quarter
- Temple / Faith Supplies

### Arcane Ward
- Potion Shop
- Arcane Shop

### Transit Yard / Docks
- Transportation

### Back Alley / Underwalk
- Tattoo Shop
- Future: Shady Dealer / Black Market

---

## Vendor Philosophy
Each vendor should be:
- a named place
- optionally tied to a named NPC
- a compact Torn-style vendor page
- a source of logically grouped goods and services
- expandable through unlocks, rarity, city type, and progression

The goal is to make the city feel inhabited and structured.

---

## Vendor Roles

### Blacksmith / Armory
Primary stock:
- melee weapons
- heavy armor
- medium armor
- shields
- repair services
- future forging and reinforcement

### Fletcher / Bowyer
Primary stock:
- bows
- crossbows
- arrows
- bolts
- quivers
- bowstrings
- ranged upgrades

### Leatherworker
Primary stock:
- light armor
- travel leathers
- straps
- pouches
- tack and harness gear
- utility wearables

### Temple / Faith Supplies
Primary stock:
- healing items
- holy supplies
- incense
- holy water equivalents
- blessings and healing services later

### General Store
Primary stock:
- everyday goods
- common clothing
- sacks
- rope
- lanterns
- writing supplies
- soap
- food basics

### Adventuring Supplies
Primary stock:
- climbing gear
- traps
- tents
- crowbars
- torches
- grappling hooks
- waterskins
- exploration tools

### Potion Shop
Primary stock:
- healing potions
- tonics
- antitoxins
- acids
- alchemical consumables
- reagent tiers

### Arcane Shop
Primary stock:
- arcane focuses
- spellbooks
- magical reagents
- wands and rods
- scrolls later
- enchanting inputs later

### Jeweler / Stonecutter
Primary stock:
- rings
- jewelry
- cut stones
- gems
- socketing / setting services
- rare material trade

### Transportation
Primary stock:
- mounts
- carts
- wagons
- saddlebags
- boarding / travel services
- ship and caravan support later

### Tattoo Shop
Primary stock:
- cosmetic inks
- magical tattoos
- passive body augments
- faction / status marks
- rare body enhancements

---

## Market Page Rule
The existing concept of a "Market" should remain a city hub, not the one and only shop.

Recommended structure:
- City
  - Market
  - Bank
  - Tavern
  - Hospital
  - City Board
  - Guilds / Consortiums

Inside Market, the player should see the shop and vendor grid, not one giant item list.

---

## Item Framework
Items will be structured into five layers.

### Layer 1: Base Mundane Items
Examples:
- daggers
- swords
- armor pieces
- lanterns
- rope
- books
- tents
- rations

These form the normal item catalog.

### Layer 2: Functional Utility Items
Examples:
- lockpicks
- climbing kits
- disguise kits
- poison kits
- healer's kits
- grappling hooks
- hunting traps
- navigator's tools

These unlock or improve interactions across travel, crime, missions, crafting, and exploration.

### Layer 3: Materials and Trade Goods
Examples:
- gemstones
- creature parts
- bone
- chitin
- mithril
- cold iron
- darkwood
- infernal steel
- shadowsilk

These support crafting, enhancement, trade, economy loops, and future black market content.

### Layer 4: Enhanced / Magical Gear
Structure:
- mundane base item
- enhancement family
- rarity tier

Examples:
- Bound Iron Dagger
- Frosted Recurve Bow
- Defender's Mail
- Ghostlight Wand

### Layer 5: Special Systems
Handled separately from normal stock:
- tattoos
- relic gear
- named artifacts
- elite crafted pieces
- rare mounts
- education-locked tools
- consortium-only items

---

## Combat Equipment Rule
Weapons and armor will not use flat damage as their primary identity.

### Weapons
Weapons should slightly modify offensive combat profile through small multipliers and bonuses, such as:
- strength scaling
- dexterity scaling
- speed
- accuracy
- crit chance
- armor penetration

### Armor
Armor should slightly modify defensive combat profile through small multipliers and tradeoffs, such as:
- defense
- endurance
- dodge
- regeneration
- speed penalty
- stamina cost

This keeps character stats as the core while making gear meaningful.

---

## Enhancement Framework
Enhancements will be grouped by role and applied in controlled slots rather than stacked infinitely.

### Starter Enhancement Pool
- Precise
- Reliable
- Bound
- Defender
- Flaming
- Frost
- Guide
- Ghost Light
- Intimidating
- Training

### Mid-Tier Pool
- Reactive
- Absorbing
- Blood Hound
- Veiling
- Vengeful
- Storm
- Aquatic
- Breaching
- Last Stand

### Relic / Artifact Pool
- Banishing
- Twin
- Spell Loader
- Spirit Binding
- Gorgon
- Ender
- Sovereign
- Primed Possession

Enhancements should be grouped into:
- Offensive
- Defensive
- Utility
- Travel
- Rogue
- Arcane
- Relic

And tagged by behavior:
- Passive
- Proc
- Charged
- Conditional
- Activated

---

## Tattoos as a Parallel System
Tattoos are approved as a separate progression and equipment layer.

They are not to be treated as normal armor or weapons.

Tattoo categories may include:
- combat marks
- travel marks
- stealth marks
- utility marks
- social / status marks
- rare body enchantments

Tattoo content should eventually include:
- passive utility bonuses
- stat support
- movement bonuses
- protection marks
- rare signature abilities

---

## Progression and Unlock Logic
Some vendors are always available, while others may improve based on progression.

### Base availability
Always available:
- General Store
- Blacksmith / Armory
- Adventuring Supplies

### Progression-sensitive vendors
Improve or unlock based on:
- city tier
- player progression
- education
- reputation
- district status
- underworld access

Examples:
- Arcane Shop improves with magical progression
- Jeweler improves in richer cities
- Tattoo Shop may begin as premium or hidden
- Transportation expands with travel progression
- Temple services improve with reputation or district strength
- Shady Dealer / Black Market unlock later

---

## UI Direction
Vendor pages should follow dense, compact, Torn-like presentation.

Each vendor should have:
- icon
- vendor name
- short description
- category tag
- optional stock quality indicator
- district location label
- enter button

Inside each vendor page:
- item list
- filters
- detail pane
- buy / sell tabs
- optional services tab

---

## Icon Direction
Icon inspiration may be taken from the simple emblem-style shop symbols used in the D&D shop references.

For Nexis, icons should be:
- monochrome or limited-color
- clean silhouettes
- compact
- readable in dark UI
- suited to category headers and vendor cards

Examples of icon subjects:
- crossed weapons for blacksmith
- bow for fletcher
- potion flask for alchemist
- arcane sigil for mage vendor
- gem emblem for jeweler
- horse or wagon for transportation
- needle or sigil for tattoo shop

Icons should be inspired by the reference style, not copied directly.

---

## Implementation Roadmap

### Phase 1: Item Taxonomy
Define:
- categories
- subcategories
- equipment slots
- rarity bands
- enhancement compatibility
- shop assignment

### Phase 2: Starter Catalog
Build the initial Nexis item catalog:
- 20 to 30 weapons
- 15 to 20 armors
- 30 to 40 utility items
- 15 to 20 tools
- 15 to 20 materials
- 10 to 15 consumables
- 8 to 12 tattoos

### Phase 3: Vendor and District Data
Create:
- district list
- vendor list
- vendor stock pools
- unlock rules
- progression hooks

### Phase 4: Enhancement Rules
Define:
- enhancement families
- rarity access
- slot rules
- item eligibility
- balancing caps

### Phase 5: UI Integration
Build:
- market vendor hub
- vendor cards
- vendor pages
- filters and details pane
- icon support
- district framing

### Phase 6: Progression and Economy Hooks
Add:
- city-tier stock variation
- limited stock or premium stock where appropriate
- unlock-based vendor expansion
- future black market integration
- crafting material demand loops

---

## Hard Rules
- Do not turn Market into one giant all-items page.
- Do not directly import 5e dice, AC, saving throw, or attunement rules.
- Do not allow enhancement stacking to become uncontrolled.
- Do not treat tattoos as ordinary equipment.
- Do not copy D&D references literally; use them as structural inspiration.

---

## Working Summary
Nexis city commerce will be built around named district vendors, structured item families, stat-scaling equipment, controlled enhancements, and special systems like tattoos.

This roadmap is the plan of action to follow when implementing city shops, itemization, and vendor-based progression.