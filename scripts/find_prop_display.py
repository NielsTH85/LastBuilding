import re

js = open('planner_asset.js', 'r', encoding='utf-8').read()

# Find the switch case that displays property names
# Look for the case statement block near "Damage Taken as Void"
idx = js.find('"Damage Taken as Void"')
if idx < 0:
    print("Not found")
    exit()

# Go further back to find the full switch/function
start = js.rfind('switch', max(0, idx - 5000), idx)
if start < 0:
    start = max(0, idx - 3000)

# Find a reasonable end
end_search = js.find('function', idx + 100)
if end_search < 0:
    end_search = idx + 10000

block = js[start:end_search]

# We know property IDs in enum: 112=ChanceToBeCrit, etc.
# Search for each enum name in the switch block
for eid, ename in [
    (112, 'ChanceToBeCrit'),
    (113, 'DamageTakenWhileMoving'),
    (114, 'ReducedBonusDamageTakenFromCrits'),
    (115, 'DamagePerStackOfAilment'),
    (116, 'IncreasedAreaForAreaSkills'),
    (117, 'GlobalConditionalDamage'),
    (118, 'ArmourMitigationAppliesToDamageOverTime'),
    (119, 'WardDecayThreshold'),
    (120, 'EffectOfAilmentOnYou'),
    (121, 'ParryChance'),
]:
    # Find in the switch block
    pat = rf'case\s+\w+\.{ename}.*?break'
    matches = re.findall(pat, block, re.S)
    if not matches:
        # Try broader search in full JS
        matches = re.findall(rf'case\s+\w+\.s\.{ename}.{{0,500}}?break', js, re.S)
    if matches:
        print(f"Enum {eid} ({ename}):")
        cleaned = matches[0].replace('\n', ' ')[:300]
        print(f"  {cleaned}")
        print()
    else:
        print(f"Enum {eid} ({ename}): NOT FOUND in switch")
        # Search broadly
        hits = re.findall(rf'.{{0,50}}{ename}.{{0,200}}', js)
        if hits:
            print(f"  Context: {hits[0][:250]}")
        print()
