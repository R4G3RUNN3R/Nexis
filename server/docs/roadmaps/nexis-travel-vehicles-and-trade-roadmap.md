# Nexis Travel, Vehicles, Animals, and Trade Roadmap

## Purpose
This document captures the approved roadmap for how animals, vehicles, transport assets, travel, trade logistics, crafting, and upgrades should work in Nexis.

This is a companion roadmap to the city vendors, item, and enhancement plan.

---

## Core Direction
Mounts, beasts of burden, and vehicles are not decorative purchases.

They are functional travel and trade assets.

This means animals and vehicles must directly support:
- travel speed
- travel safety
- cargo capacity
- trade operations
- route efficiency
- progression into better logistics systems

Vehicles must also be craftable and upgradeable.

---

## Travel Asset Types
Nexis transport assets will be separated into the following categories.

### Personal Travel Animals
Examples:
- donkey
- mule
- riding horse
- pony
- camel
- mastiff

Purpose:
- lower travel burden
- increase movement efficiency on land
- carry modest cargo
- unlock early trade and courier use

### Heavy / Trade Animals
Examples:
- draft horse
- ox equivalent later
- elephant in certain regions
- warhorse in military use cases

Purpose:
- haul carts and wagons
- increase bulk transport
- support caravan operations
- support future city / guild logistics

### Light Vehicles
Examples:
- cart
- sled
- rowboat

Purpose:
- early hauling
- short-distance travel
- basic trade loops

### Heavy Vehicles
Examples:
- wagon
- carriage
- chariot
- future caravan wagons

Purpose:
- long-range trade
- protected cargo hauling
- better passenger and inventory capacity

### Water Transport
Examples:
- rowboat
- keelboat
- longship
- sailing ship
- warship later

Purpose:
- water travel
- merchant routes
- coastal trade
- higher-value logistics

---

## Core System Rule
Travel animals and vehicles must influence real gameplay values.

They should affect:
- travel time
- cargo capacity
- travel risk
- route access
- number of carried goods
- party / passenger support later

They are not to be handled as cosmetic purchases.

---

## Base Functional Stats
Every animal or vehicle should eventually have a structured data profile.

Suggested fields:
- id
- name
- category
- subtype
- terrainType
- travelSpeedModifier
- cargoCapacity
- passengerCapacity
- durability
- maintenanceCost
- upgradeSlots
- craftable
- vendorSource
- requirements

### For animals
Include:
- temperament / control difficulty later if needed
- feed cost
- carrying capacity
- mounted use eligibility

### For vehicles
Include:
- draft requirement
- wheel / hull condition later
- protection rating
- trade suitability
- storage class

---

## Travel Use Rules

### On foot
Baseline, slow, highest burden.

### With an animal
Improves travel efficiency depending on animal type.
Examples:
- donkey or mule: modest cargo, stable early utility
- riding horse: faster travel, lower cargo focus
- camel: strong desert route utility
- draft horse: stronger hauling for trade

### With a vehicle
Vehicles should greatly improve trade capacity and reduce the friction of moving goods.
Examples:
- cart: basic local hauling
- wagon: strong land trade backbone
- carriage: prestige / passenger transport, lower utility for bulk trade
- rowboat: local waterways and fishing / river access

---

## Trade Role
Vehicles and animals are directly tied to trade.

They should influence:
- how much a player can transport
- what routes are economically viable
- whether high-volume trade is possible
- whether rare or fragile goods can be moved safely
- whether escorts or caravan systems become worthwhile later

### Example progression
- no transport: small personal hauling only
- donkey / mule: small trade loop support
- cart: local trade route operations
- wagon: large overland trade
- ship: regional / intercity water trade

This gives transport a real economy role.

---

## Crafting Rule
Vehicles will be craftable.

This is approved.

Crafting should apply to:
- carts
- wagons
- sleds
- rowboats
- later specialized trade vehicles

Crafting should not necessarily apply to all animals, but gear for them absolutely should.

Examples of craftable support items:
- saddlebags
- reinforced harnesses
- covered cargo frames
- storage compartments
- reinforced wheels
- weatherproofing

---

## Upgrade Rule
Vehicles may be upgraded rather than treated as one-and-done purchases.

This is approved.

These are not magical enhancements in the same sense as weapons.
They should usually be called upgrades.

### Upgrade examples
- reinforced frame
- lighter chassis
- expanded cargo bed
- suspension improvements
- hidden compartment
- armored plating
- weatherproof canopy
- superior tack and harnessing
- speed tuning
- better brakes / steering equivalent
- riverproof or seaworthy modifications later

Upgrades should be expensive by default.

---

## Skill Discount Rule
If a player has the relevant skill, vehicle crafting and upgrading should become significantly cheaper.

This is approved as a core rule.

### Design logic
A skilled player should be rewarded for investment in:
- crafting
- engineering
- woodworking
- smithing
- leatherworking
- transport logistics
- maritime construction later

### Effect
Relevant skill ownership should:
- reduce crafting cost
- reduce upgrade cost
- possibly reduce repair cost
- possibly improve crafted quality later

This discount should be meaningful, not token.

Recommended philosophy:
- no skill = full price
- trained = noticeable reduction
- high skill = major reduction and better output potential later

---

## Education / Skill Hooks
Transport systems should eventually be affected by education and skill progression.

### Relevant future hooks
- Practical Arithmetic for trade efficiency
- World Geography for safer and more effective travel
- Craftsmanship / Artifice for parts and upgrades
- Maritime Training for watercraft use and improvement
- future logistics-related skills for cargo optimization

This keeps transport tied into the wider Nexis progression ecosystem.

---

## Vendor Hooks
Transport assets should primarily connect to:
- Transportation vendor
- Leatherworker for tack / harness / animal gear
- Blacksmith / Armory for metal reinforcements
- Carpenter / crafting support later
- General Store / Adventuring Supplies for basic field goods

Vehicles should not live in an isolated system detached from city vendors.

---

## Upgrade Categories
To keep the system readable, upgrades should be grouped.

### Structural
- reinforced frame
- stronger axle
- heavier hull
- durability boosts

### Capacity
- larger cargo hold
- expanded saddlebags
- stacked storage racks
- compartment upgrades

### Speed / Efficiency
- lighter construction
- better wheels
- better fitting harness
- streamlined hull later

### Protection
- covered cargo
- rainproofing
- lockbox compartment
- armored shelling later

### Stealth / Utility
- hidden compartment
- false panels
- quiet movement treatment later

### Specialized Route Upgrades
- desert-ready kit
- mountain-ready kit
- marsh-ready kit
- river-ready kit

---

## Economy Rules
Transport assets should create meaningful economic thresholds.

### Intended progression feel
- players without transport trade in tiny amounts
- players with basic transport can run local loops
- players with upgraded wagons or ships can enter serious trade play

This creates a logistics ladder similar to power ladders in combat, but for economy.

---

## Balance Rules
- Vehicles must be useful, but not invalidate travel decisions.
- Upgrades must be expensive enough to remain aspirational.
- Skill discounts must be significant enough to reward specialization.
- Transport should improve logistics, not delete all travel risk.
- Water and land transport should eventually feel distinct.

---

## UI Direction
Transportation should eventually have its own clean page or section.

Suggested display blocks:
- owned animals
- owned vehicles
- cargo capacity
- route capability
- upgrade slots
- condition / maintenance later
- craft new transport
- upgrade existing transport

Travel page should reference the chosen travel asset directly.
Trade systems should reference capacity directly.

---

## Implementation Roadmap

### Phase 1: Transport Taxonomy
Define:
- animal classes
- vehicle classes
- core stats
- cargo rules
- route role

### Phase 2: Starter Asset Catalog
Initial transport list should include:
- donkey / mule
- pony
- riding horse
- draft horse
- cart
- wagon
- rowboat
- saddlebags
- harness gear

### Phase 3: Travel Integration
Connect transport assets to:
- travel speed
- route choice
- burden / cargo handling
- future mishap reduction hooks

### Phase 4: Trade Integration
Connect transport assets to:
- cargo volume
- trade limits
- route profitability
- merchant progression

### Phase 5: Crafting and Upgrades
Add:
- craftable vehicles
- upgrade slots
- upgrade categories
- skill-based price reductions

### Phase 6: Advanced Logistics
Later expansion:
- ship classes
- caravan systems
- escort systems
- smuggling compartments
- faction or consortium logistics

---

## Hard Rules
- Animals and vehicles are not cosmetic fluff.
- Vehicles must support both travel and trade.
- Vehicles must be craftable.
- Vehicles may be upgraded and those upgrades should be expensive.
- Relevant skills must significantly reduce crafting and upgrade costs.
- Transport must stay integrated with city vendors, travel, and trade systems.

---

## Working Summary
Nexis transport will be a real progression system built around animals, vehicles, cargo, trade, crafting, and expensive upgrades. Skill investment will materially reduce vehicle crafting and upgrade costs, making transport progression a meaningful specialization path rather than just a money sink.