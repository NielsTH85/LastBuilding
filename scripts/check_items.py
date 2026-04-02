import json
data = json.load(open('maxroll-build-example.json'))
items = data['items']
p = data['profiles'][1]
for slot, idx in p['items'].items():
    item = items.get(str(idx))
    if item:
        has_unique = 'uniqueID' in item and item['uniqueID'] is not None
        num_affixes = len(item.get('affixes', []))
        has_sealed = 'sealedAffix' in item and item['sealedAffix'] is not None
        max_tier = max((a['tier'] for a in item.get('affixes', [])), default=0)
        rarity = 'unique' if has_unique else 'exalted' if max_tier >= 6 else 'rare' if num_affixes >= 3 else 'magic'
        print(f"{slot}: type={item['itemType']} sub={item['subType']} rarity={rarity} affixes={num_affixes} maxTier={max_tier} sealed={has_sealed} unique={has_unique}")
