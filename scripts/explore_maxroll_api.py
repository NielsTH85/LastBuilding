"""Explore the maxroll planner API response format."""
import urllib.request, json, sys

url = 'https://planners.maxroll.gg/profiles/last-epoch/295tdl0o'
req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0',
    'Accept': 'application/json',
    'Origin': 'https://maxroll.gg'
})
resp = urllib.request.urlopen(req)
raw = json.loads(resp.read())
data = json.loads(raw['data'])

# Save full data for later reference
with open('maxroll-build-example.json', 'w') as f:
    json.dump(data, f, indent=2)

for i, p in enumerate(data['profiles']):
    print(f"Profile {i}: {p.get('name')} (class={p.get('class')}, mastery={p.get('mastery')})")

print()

# Profile #2 from the URL fragment (0-indexed)
profile_idx = int(sys.argv[1]) if len(sys.argv) > 1 else 1
p = data['profiles'][profile_idx]
print(f"=== profile[{profile_idx}]: {p.get('name')} ===")
print(f"  class: {p.get('class')}")
print(f"  mastery: {p.get('mastery')}")
print(f"  level: {p.get('level')}")
print()

# Items
items_map = p.get('items', {})
print(f"  items (slot -> item index): {items_map}")
print()

# Show the actual item for weapon
all_items = data.get('items', {})
for slot, idx in items_map.items():
    item = all_items.get(str(idx))
    if item:
        print(f"  {slot} (items[{idx}]): {json.dumps(item)[:200]}")
print()

# Skills
print(f"  activeSkills: {p.get('activeSkills')}")
print(f"  specializedSkills: {p.get('specializedSkills')}")
print()

# Skill trees
st = p.get('skillTrees', {})
print(f"  skillTrees type: {type(st).__name__}")
if isinstance(st, dict):
    print(f"  skillTrees keys: {list(st.keys())}")
    for k, v in st.items():
        print(f"  skillTrees[{k}]: {str(v)[:400]}")
elif isinstance(st, list):
    print(f"  skillTrees len: {len(st)}")
    for i, v in enumerate(st):
        print(f"  skillTrees[{i}]: {str(v)[:400]}")
print()

# Passives
ps = p.get('passives', {})
print(f"  passives type: {type(ps).__name__}")
if isinstance(ps, dict):
    print(f"  passives keys: {list(ps.keys())}")
    for k, v in ps.items():
        print(f"  passives[{k}]: {str(v)[:400]}")
print()

# Blessings
bl = p.get('blessings', [])
print(f"  blessings: {str(bl)[:400]}")
print()

# Idols
idols = p.get('idols', [])
print(f"  idols: {str(idols)[:400]}")
print()

# Weaver
weaver = p.get('weaver', {})
print(f"  weaver: {str(weaver)[:400]}")
