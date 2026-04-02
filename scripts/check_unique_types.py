import json
data = json.load(open('maxroll-game-data.json', 'r', encoding='utf-8'))

# Check type=0,1,2 examples
for t_val in [0, 1, 2]:
    print(f"type={t_val} examples:")
    count = 0
    for u in data['uniques']:
        for m in u.get('mods', []):
            if m.get('type', 0) == t_val and count < 4:
                name = u['name']
                print(f"  {name}: prop={m['property']} val={m['value']} tags={m.get('tags',0)} st={m.get('specialTag',0)}")
                count += 1
    print()

# Verify our Ladle import vs raw 
print("=== LADLE COMPARISON ===")
for u in data['uniques']:
    if 'Ladle' in u['name']:
        print(f"Raw {u['name']} mods:")
        for m in u['mods']:
            print(f"  prop={m['property']} val={m['value']} max={m.get('maxValue',0)} tags={m['tags']} st={m.get('specialTag',0)} type={m.get('type',0)} hide={m.get('hideInTooltip',False)}")
        break

# check our current import
our = json.load(open('../packages/game-data/src/data/uniques-import.json', 'r', encoding='utf-8'))
for u in our:
    if 'Ladle' in u['name']:
        print(f"\nOur import {u['name']} mods:")
        for m in u['mods']:
            print(f"  prop={m['property']} val={m['value']} max={m.get('maxValue','?')} tags={m.get('tags',0)}")
        break

# Count hideInTooltip vs not for Calamity (#0) 
print("\n=== CALAMITY ===")
for u in data['uniques']:
    if u['uniqueID'] == 0:
        for m in u['mods']:
            print(f"  prop={m['property']} val={m['value']} tags={m['tags']} st={m.get('specialTag',0)} type={m.get('type',0)} hide={m.get('hideInTooltip',False)}")
        break
