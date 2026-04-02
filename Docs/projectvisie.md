Projectvisie: Last Building
Doel

Een desktop/web app voor Last Epoch-achtige build planning die:

passives, skills en items combineert in één build
alle relevante derived stats berekent
per wijziging direct laat zien wat het effect is
skill node, passive node, affix en item impact inzichtelijk maakt
later uitbreidbaar is met presets, comparisons, leveling en imports
Kernbelofte

De gebruiker moet op elk moment kunnen zien:

wat mijn build nu doet
wat er verandert als ik één node punt
wat er verandert als ik één affix wissel
wat het totaalplaatje is voor damage, defenses, sustain en utility

Dus niet alleen “planner”, maar planner + simulator + delta analyzer.

Scope fasering
Fase 1 — Foundations / MVP

Doel: werkende planner met betrouwbare stat engine.

Features
class + mastery kiezen
passives alloceren
5 skills kiezen en skill nodes alloceren
items per slot kiezen
affixes op items zetten
baseline stats + derived stats berekenen
stat delta tonen bij hover/select/change
build opslaan/laden als JSON
Nog niet
online sync
scraping/import van externe planners
full DPS sim met timing/rotation
exalted/LP crafting simulatie
advanced enemy modelling
perfect UI polish
Fase 2 — Real build analysis
offensive calculations per skill
defensive layers tegen verschillende damage types
sustain metrics
buff/toggle system
skill-specific breakdowns
compare snapshots
Fase 3 — Power-user mode
gear optimizer
breakpoint analysis
build share links
import adapters
versioned game data packs
community templates
Productprincipes
1. Data-first

Alles draait op datafiles, niet hardcoded logic.

Dus:

passives in JSON
skills in JSON
item bases in JSON
affixes in JSON
formulas via gestandaardiseerde modifiers
2. Deterministic engine

Zelfde input = exact dezelfde output.

Dat is cruciaal voor:

debuggen
tests
comparison mode
vertrouwen van gebruikers
3. Explainability

Niet alleen “DPS = 143k”, maar ook:

waar komt dat vandaan
welke modifiers tellen mee
wat veranderde door deze node
4. Delta everywhere

Elke wijziging moet direct een verschil laten zien:

+12 vitality
+84 ward
+6.3% crit chance
-1.8% attack speed
+11.2% average hit
High-level architectuur
/apps
  /desktop-or-web-shell
/packages
  /game-data
  /build-model
  /calc-engine
  /rules-engine
  /ui-components
  /state-store
  /serialization
  /testing-fixtures
Package rollen
game-data

Bevat ruwe data:

classes
masteries
passive trees
skill trees
item bases
affixes
uniques
idols
blessings
implicit stats
tags
build-model

TypeScript domeinmodellen:

Build
Character
AllocatedPassiveNode
EquippedItem
SkillLoadout
ActiveBuffSet
EnemyProfile
calc-engine

De pure rekenlaag:

modifier aggregation
stat pipeline
derived calculations
snapshots
delta comparison
rules-engine

Game-specifieke regels:

node prerequisites
exclusivity rules
skill unlock logic
equip restrictions
mastery requirements
state-store

App state:

current build
selection
hover preview
undo/redo
snapshots
ui-components

Herbruikbare UI:

passive tree canvas
skill tree editor
item editor
stat panel
delta cards
compare panel
serialization
JSON save/load
share format
future import adapters
Domeinmodel
Build
type Build = {
  version: string;
  character: CharacterState;
  passives: PassiveAllocation[];
  skills: SkillAllocation[];
  equipment: EquipmentState;
  idols: IdolState[];
  blessings: BlessingState[];
  toggles: ToggleState[];
  config: SimulationConfig;
};
CharacterState
type CharacterState = {
  classId: string;
  masteryId?: string;
  level: number;
  attributes: BaseAttributes;
};
EquipmentState
type EquipmentState = {
  helmet?: EquippedItem;
  bodyArmor?: EquippedItem;
  gloves?: EquippedItem;
  boots?: EquippedItem;
  weapon1?: EquippedItem;
  weapon2?: EquippedItem;
  relic?: EquippedItem;
  belt?: EquippedItem;
  ring1?: EquippedItem;
  ring2?: EquippedItem;
  amulet?: EquippedItem;
};
EquippedItem
type EquippedItem = {
  baseId: string;
  rarity: "normal" | "magic" | "rare" | "exalted" | "unique" | "set";
  affixes: ItemAffixRoll[];
  implicits?: AppliedModifier[];
  uniqueEffects?: AppliedModifier[];
  seals?: ItemAffixRoll[];
  forgingPotential?: number;
  legendaryPotential?: number;
};
Snapshot

De calc engine levert altijd een immutable snapshot terug:

type BuildSnapshot = {
  stats: Record<string, number>;
  offensive: OffensiveSummary;
  defensive: DefensiveSummary;
  sustain: SustainSummary;
  sources: StatSourceBreakdown[];
};
Rekenkern: hoe je dit goed aanpakt

De fout die veel planners maken is dat ze overal aparte formules hardcoden. Jij wilt liever een modifier pipeline.

Stap 1 — alles vertalen naar modifiers

Elke passive node, skill node, affix of unique effect wordt één of meer modifiers.

Voorbeeld:

type Modifier = {
  id: string;
  sourceType: "passive" | "skillNode" | "item" | "implicit" | "blessing" | "buff";
  sourceId: string;
  targetStat: string;
  operation: "add" | "increased" | "more" | "set" | "convert" | "override";
  value: number;
  conditions?: Condition[];
  tags?: string[];
};
Stap 2 — modifier aggregation

Alle actieve modifiers verzamelen en groeperen per target stat.

Stap 3 — stat resolution pipeline

Per stat in vaste volgorde uitrekenen:

base
added flat
increased/decreased
more/less
conversions
clamps/caps
derived downstream stats
Stap 4 — dependency graph

Sommige stats hangen van andere af:

vitality → health
intelligence → ward retention / spell scaling
crit chance + crit multi → average hit
armor + endurance + resists → effective survivability

Dus je wilt een eenvoudige dependency graph zodat derived stats in juiste volgorde worden berekend.

Belangrijke statgroepen
A. Primary stats
strength
dexterity
intelligence
vitality
attunement
B. Core offense
melee damage
spell damage
minion damage
attack speed
cast speed
crit chance
crit multiplier
penetration
added damage
increased damage by type
more multipliers
ailment chance/effect
C. Core defense
health
ward
armor
dodge
block chance/effectiveness
endurance
resistances
less damage taken
damage taken as
glancing blow / similar if relevant to modeled version
D. Sustain & utility
mana
mana regen
leech
ward generation/retention
cooldown recovery
movement speed
De echte USP: delta engine

Dit wordt jouw killer feature.

Wat moet de app tonen?

Bij hover op een passive node:

Current Health: 1240 → 1316 (+76)
Ward Retention: 312% → 348% (+36%)
Average Hit: 18,420 → 19,105 (+685)
Effective HP vs Physical: 5,810 → 6,144 (+334)

Bij item wissel:

Crit chance +4.1%
Cast speed -7%
Mana efficiency +12
Necrotic DPS +9.8%
Fire DPS 0%
Technische aanpak

Niet proberen “per stat live differentials” handmatig te berekenen.

Gewoon:

bereken snapshotA
pas wijziging tijdelijk toe
bereken snapshotB
diff snapshotB - snapshotA

Dat is simpeler, betrouwbaarder en makkelijker te debuggen.

UI modules
1. Build workspace

Hoofdscherm met 4 panelen:

links: class / passives
midden: skill tree of item editor
rechts: stat summary + delta
onder: build notes / compare / config
2. Passive tree viewer

Features:

zoom/pan
prerequisites lijnen
hover preview
click allocate/deallocate
right panel met impact summary
3. Skill tree editor
skill select
node tree
node preview
skill-specific stat output
4. Item editor
slot kiezen
base item kiezen
affixes instellen
roll sliders
unique toggles
5. Stats panel

Tabs:

All stats
Offense
Defense
Sustain
Minions
Skill breakdown
6. Compare mode
current vs saved snapshot
old item vs new item
old skill path vs new skill path
Tech stack advies
Beste keuze voor jou

Omdat jij graag modulair werkt en snel wilt itereren:

Frontend
TypeScript
React
Vite
Zustand of Redux Toolkit voor state
TanStack Query alleen als je later remote data wilt
Tailwind voor snelheid
React Flow / custom canvas / Konva / Pixi voor trees, afhankelijk van voorkeur
Desktop verpakking
Tauri
lichtgewicht
snel
prettig voor desktop app gevoel

Als je eerst web wilt:

begin als pure web app
desktop shell later
Tests
Vitest
pure engine tests
fixture-based regression tests
Aanbevolen repo-structuur
last-building/
  apps/
    planner-web/
  packages/
    game-data/
    build-model/
    calc-engine/
    rules-engine/
    ui-components/
    serialization/
    test-fixtures/
  docs/
    architecture.md
    stat-pipeline.md
    data-schema.md
    roadmap.md
    copilot-instructions.md
Data strategie
Bronnen

Je zult waarschijnlijk veel data handmatig/semiautomatisch moeten modelleren.

Dus maak onderscheid tussen:

Raw data

Exact overgenomen of verzamelde brondata

/game-data/raw
Normalized data

Jouw nette interne format

/game-data/normalized
Generated indexes

Snelle lookup tables

/game-data/generated
Waarom?

Omdat brondata later kan veranderen, maar jouw engine stabiel moet blijven.

MVP backlog
Epic 1 — Project foundation
monorepo setup
TypeScript strict mode
linting/formatting
test runner
package boundaries
basic CI
Epic 2 — Game data schema
define stat ids
define modifier schema
define item schema
define passive node schema
define skill node schema
Epic 3 — Build model
create build types
equip item flow
allocate passive flow
allocate skill node flow
save/load JSON
Epic 4 — Calc engine v1
base stats
modifier aggregation
additive/increased/more pipeline
health/ward/armor/resist calculations
snapshot output
Epic 5 — UI v1
build shell
passive editor
skill editor
item editor
stat panel
Epic 6 — Delta system
temporary mutation preview
snapshot compare
delta cards
hover integration
Epic 7 — Regression testing
golden build fixtures
expected stat snapshots
diff validation
Risico’s
1. Te vroeg volledige DPS simulatie willen

Niet doen in MVP.

Begin met:

average hit
cast/attack frequency
ailment uptime approximations
simple expected DPS

Later pas:

rotation sim
proc chains
conditional uptime
enemy behavior
2. Data inconsistentie

Maak stat ids en modifier rules vanaf dag 1 super strak.

3. UI te vroeg mooi willen maken

De engine is het product. UI polish komt later.

4. Alles tegelijk willen ondersteunen

Begin met:

1 class
1 mastery
beperkt aantal skills
beperkt itemset

Dan pas opschalen.

Developmentvolgorde die ik echt zou aanraden
Sprint 1
repo opzetten
stat ids definiëren
modifier model definiëren
simpele character + item build JSON
Sprint 2
calc engine voor base stats + health/ward/armor/resists
unit tests
Sprint 3
passive nodes als modifiers
simpele passive tree UI
hover delta
Sprint 4
skill nodes als modifiers
skill tree UI
skill output summary
Sprint 5
item editor
affix rolls
stat panel
Sprint 6
compare snapshots
save/load builds
polish MVP