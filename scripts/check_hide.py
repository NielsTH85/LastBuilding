import json
data = json.load(open('maxroll-game-data.json', 'r', encoding='utf-8'))

# Check hideInTooltip semantics
test_items = ['Calamity', 'Fractured Crown', 'Snowblind', 'Wings of Argentus', 'Fiery Dragon Shoes', 'Legends Entwined']
for name in test_items:
    for u in data['uniques']:
        if u['name'] == name:
            print(f"{name}:")
            for m in u['mods']:
                hide = m.get('hideInTooltip', False)
                prop = m['property']
                val = m['value']
                st = m.get('specialTag', 0)
                tp = m.get('type', 0)
                print(f"  prop={prop} val={val} st={st} type={tp} hide={hide}")
            print()
            break
