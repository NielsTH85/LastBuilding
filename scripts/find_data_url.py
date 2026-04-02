import re
js = open('planner_asset.js', 'r', encoding='utf-8').read()

# The URL pattern we found: "https://planners.maxroll.gg/".concat(e)
# So data.json should be at https://planners.maxroll.gg/data.json
# But it 404'd. Maybe there's a versioned/hashed URL.

# Check for data-*.json or data.*.json patterns
for pat in [r'data[\w.-]*\.json', r'\.json["\']']:
    matches = re.findall(pat, js)
    unique_matches = list(set(matches))
    print(f"Pattern '{pat}': {len(unique_matches)} unique matches")
    for m in unique_matches[:20]:
        print(f"  {m}")
    print()

# Also check what Object(i.h) resolves to
# Find the module that exports 'h' which is used for URL construction
idx = js.find('"data.json"')
if idx < 0:
    idx = js.find("'data.json'")
if idx >= 0:
    print(f"Found data.json reference at {idx}")
    print(js[max(0,idx-300):idx+100])
else:
    print("No data.json string reference found")

# Try finding the base URL more precisely
print("\n\nSearching for planners.maxroll.gg paths:")
matches = re.findall(r'planners\.maxroll\.gg[^"\']*', js)
for m in list(set(matches))[:10]:
    print(f"  {m}")

print("\n\nSearching for assets-ng.maxroll.gg paths:")
matches = re.findall(r'assets-ng\.maxroll\.gg[^"\']*', js)
for m in list(set(matches))[:10]:
    print(f"  {m}")
