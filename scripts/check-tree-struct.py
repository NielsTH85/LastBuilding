import json
d = json.load(open(r'c:\eob\maxroll-game-data.json', encoding='utf-8'))
st = d['skillTrees']

# Look at the Mage tree structure more carefully
mg = st['mg-1']
print(f"mg-1 type: {type(mg)}")
if isinstance(mg, dict):
    print(f"mg-1 keys: {list(mg.keys())[:30]}")
elif isinstance(mg, list):
    print(f"mg-1 length: {len(mg)}")
    if mg:
        item = mg[0]
        print(f"first item type: {type(item)}")
        print(f"first item keys: {list(item.keys())[:20] if isinstance(item, dict) else item}")
        # print first item
        if isinstance(item, dict):
            for k, v in list(item.items())[:15]:
                val_str = str(v)[:100]
                print(f"  {k}: {val_str}")

# check a few more items
if isinstance(mg, list) and len(mg) > 1:
    print(f"\nSecond item:")
    item = mg[1]
    if isinstance(item, dict):
        for k, v in list(item.items())[:15]:
            val_str = str(v)[:100]
            print(f"  {k}: {val_str}")
