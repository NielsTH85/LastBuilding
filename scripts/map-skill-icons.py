import json

with open(r'c:\eob\packages\game-data\src\data\maxroll-import.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=== Runemaster Skills ===")
for s in data['skills']['runemaster']:
    print(f"  {s['abilityKey']}: {s['name']}")

print("\n=== Mage Base Skills ===")
for s in data['skills']['mageBase']:
    print(f"  {s['abilityKey']}: {s['name']}")

# Now list all extracted icons matching skill names
import os
icons_dir = r'C:\eob\apps\planner-web\public\icons\all'
all_icons = sorted(os.listdir(icons_dir))

# Skills to match
skill_names = []
for s in data['skills']['mageBase'] + data['skills']['runemaster']:
    skill_names.append(s['name'])

print("\n=== Icon Matches ===")
for name in skill_names:
    name_lower = name.lower().replace(' ', '-').replace('_', '-')
    matches = [i for i in all_icons if name_lower in i.lower().replace('_', '-')]
    if matches:
        print(f"  {name}: {matches[:5]}")
    else:
        # Try partial match
        words = name_lower.split('-')
        partial = [i for i in all_icons if all(w in i.lower() for w in words[:2])]
        if partial:
            print(f"  {name}: (partial) {partial[:5]}")
        else:
            print(f"  {name}: NO MATCH")
