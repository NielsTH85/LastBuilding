const data = require("../packages/game-data/src/data/maxroll-import.json");

const damageStats = [];
for (const cls of data.classes) {
  for (const [, skills] of Object.entries(cls.skills || {})) {
    for (const sk of skills) {
      for (const n of sk.nodes || []) {
        for (const s of n.stats || []) {
          const k = s.statName.toLowerCase().trim();
          if (k === "damage") {
            damageStats.push({ skill: sk.name, node: n.name, value: s.value, cls: cls.class.name });
          }
        }
      }
    }
  }
}
console.log("Damage stat occurrences:", damageStats.length);
damageStats
  .slice(0, 15)
  .forEach((d) => console.log("  " + d.cls + " / " + d.skill + " / " + d.node + ": " + d.value));

// Check added_* flat damage
const addedDamageStats = [];
for (const cls of data.classes) {
  for (const [, skills] of Object.entries(cls.skills || {})) {
    for (const sk of skills) {
      for (const n of sk.nodes || []) {
        for (const s of n.stats || []) {
          const k = s.statName.toLowerCase().trim();
          if (
            (k.includes("added") && k.includes("damage")) ||
            (k.includes("fire damage") && !k.includes("increased")) ||
            (k.includes("cold damage") && !k.includes("increased")) ||
            (k.includes("lightning damage") && !k.includes("increased")) ||
            (k.includes("melee physical") && !k.includes("increased")) ||
            (k.includes("base damage") && !k.includes("increased"))
          ) {
            addedDamageStats.push({
              skill: sk.name,
              node: n.name,
              stat: s.statName,
              value: s.value,
              cls: cls.class.name,
            });
          }
        }
      }
    }
  }
}
console.log("\nAdded/flat damage stats:", addedDamageStats.length);
addedDamageStats
  .slice(0, 20)
  .forEach((d) =>
    console.log("  " + d.cls + " / " + d.skill + " / " + d.node + ": " + d.stat + " " + d.value),
  );
