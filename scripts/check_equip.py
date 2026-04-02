import json
with open(r'c:\eob\packages\game-data\src\data\equipment-import.json') as f:
    data = json.load(f)
print(f'Keys: {list(data.keys())}')
if 'items' in data:
    print(f'Items: {len(data["items"])}')
if 'affixes' in data:
    print(f'Affixes: {len(data["affixes"])}')
    print(f'Sample affix:\n{json.dumps(data["affixes"][0], indent=2)[:600]}')
