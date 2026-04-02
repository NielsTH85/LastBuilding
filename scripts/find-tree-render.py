import re

js = open(r'c:\eob\scripts\planner_asset.js', 'r', encoding='utf-8').read()

# Search for tree node positioning - the passiveNode/skillNode rendering
for pat in [
    r'transform.*\.x.*\.y',    # CSS/SVG transform with x/y
    r'startCentered',
    r'nodeSize',
    r'treeWidth',  
    r'treeHeight',
    r'72em',
    r'49\.4',
    r'65\.7',
    r'\.transform\.x',
    r'\.x\s*\*',
]:
    matches = re.findall(r'.{0,80}' + pat + r'.{0,120}', js)
    if matches:
        uniq = list(set(m.strip()[:200] for m in matches))[:3]
        print(f"'{pat}' ({len(matches)} hits):")
        for m in uniq:
            print(f"  {m}")
        print()
