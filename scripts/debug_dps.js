const data = require('./packages/game-data/src/data/maxroll-import.json');

// Check how 'damage' stat appears in skill/passive nodes
const damageStats = [];
for (const cls of data.classes) {
  for (const [, skills] of Object.entries(cls.skills || {})) {
    for (const sk of skills) {
      for (const n of sk.nodes || []) {
        for (const s of n.stats || []) {
          const k = s.statName.toLowerCase().trim();
          if (k === 'damage') {
            damageStats.push({skill: sk.name, node: n.name, value: s.value, cls: cls.class.name});
          }
        }
      }
    }
  }
}
console.log("Skill nodes with 'damage' stat:", damageStats.length, "occurrences");
damageStats.slice(0, 20).forEach(d => console.log("  " + d.cls + " / " + d.skill + " / " + d.node + ": " + d.value));

// Also check what the mapped value would be
// damage -> {targetStat: "damage", operation: "more"}
// So "+4%" becomes a "more" modifier with value 4
// Then in derived.ts: baseDmg = getStat(stats, "damage")
// But "damage" stat has base=0, added=0, increased=0, more=4
// => afterAdd = 0+0 = 0 => everything is 0!
console.log("\nISSUE: 'damage' stat is mapped to operation: 'more'");
console.log("  But the DPS formula reads damage as a FLAT base.");
console.log("  Since no 'add' mods exist for 'damage', the base is always 0.");
console.log("  0 * (1 + more%) = still 0 => DPS stays near 0");
