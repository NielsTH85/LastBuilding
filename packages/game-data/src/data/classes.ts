import type { ClassDef } from "../types/class.js";

export const mageClass: ClassDef = {
  id: "mage",
  name: "Mage",
  baseStats: {
    strength: 5,
    dexterity: 5,
    intelligence: 10,
    vitality: 6,
    attunement: 8,
    health: 80,
    mana: 40,
    mana_regen: 8,
    armor: 0,
    dodge_rating: 0,
    movement_speed: 0,
    crit_chance: 5,
    crit_multiplier: 200,
  },
  masteries: [
    {
      id: "runemaster",
      name: "Runemaster",
      classId: "mage",
      bonusStats: {
        intelligence: 4,
        attunement: 2,
        ward_retention: 10,
      },
    },
  ],
};
