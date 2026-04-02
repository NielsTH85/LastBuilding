import re

js = open('planner_asset.js', 'r', encoding='utf-8').read()

# Search for any image URL containing "skill" or "tree"
pattern = r'["\']([^"\']*(?:skill|tree)[^"\']*\.(?:webp|png|jpg))["\']'
matches = re.findall(pattern, js, re.I)
seen = set()
for m in matches:
    if m not in seen:
        seen.add(m)
        print(m)

print("\n--- Also search for background in skill tree context ---")
# Find treeAtlas or tree background references
pattern2 = r'["\']([^"\']*(?:Bg|bg|background)[^"\']*\.(?:webp|png|jpg))["\']'
matches2 = re.findall(pattern2, js, re.I)
seen2 = set()
for m in matches2:
    if m not in seen2:
        seen2.add(m)
        print(m)
