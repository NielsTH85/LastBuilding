import re
js = open('planner_asset.js', 'r', encoding='utf-8').read()

# Find specialTag enum - look for e[e.Ignite=N]="Ignite" pattern
idx = js.find('.Ignite=')
if idx > 0:
    start = js.rfind('function', max(0, idx - 3000), idx)
    if start < 0:
        start = max(0, idx - 1000)
    end = js.find('}({})', idx)
    if end > 0:
        block = js[start:end+5]
        print("SpecialTag enum block:")
        print(block[:3000])
    else:
        print(js[idx-200:idx+500])
else:
    print("Ignite not found")
    # Try alternative
    idx2 = js.find('Bleed=')
    if idx2 > 0:
        print(js[idx2-300:idx2+500])
