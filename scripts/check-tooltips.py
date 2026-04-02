import json
d = json.load(open(r'c:\eob\packages\game-data\src\data\maxroll-import.json', encoding='utf-8'))
nodes = d['passives']['baseMage']
for n in nodes[:3]:
    print(f"=== {n['name']} (max {n['maxPoints']}) ===")
    print(f"  description: {n.get('description','')[:200]}")
    print(f"  altText: {n.get('altText','')[:200]}")
    print(f"  stats:")
    for s in n['stats']:
        print(f"    {s['statName']}: {s['value']} (downside={s['downside']})")
    print()
