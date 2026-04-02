"""
Extract unique items data from maxroll planner_asset.js.
The uniques are stored as part of a large data blob that gets loaded.
We need to find the array of unique definitions.
"""
import re, json

js = open('planner_asset.js', 'r', encoding='utf-8').read()

# The uniques are set via: a.a.uniques = Object.fromEntries(t.uniques.map((e=>[e.uniqueID,e])))
# So 't' is the raw data object. Let's find where t.uniques is referenced during init.
# The data likely comes from a JSON-like chunk embedded in the JS.

# Search for the data initialization pattern - look for uniqueID patterns in the data
# Find array patterns that contain uniqueID fields

# Strategy: find a unique entry pattern and extract surrounding context
# Look for {uniqueID:NNN,name:"..." pattern
matches = re.findall(r'\{uniqueID:\d+,name:"[^"]*"', js)
print(f"Found {len(matches)} unique definitions with name")
for m in matches[:10]:
    print(f"  {m}")

# Now find the broader pattern to get full unique entries
# Get surrounding context for first match to see structure
if matches:
    idx = js.find(matches[0])
    # Find the start of this object
    depth = 0
    start = idx
    end = idx
    for i in range(idx, min(idx + 2000, len(js))):
        if js[i] == '{':
            depth += 1
        elif js[i] == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    chunk = js[start:end]
    print(f"\nFull first unique entry ({len(chunk)} chars):")
    print(chunk[:500])
    print("...")
    print(chunk[-200:] if len(chunk) > 500 else "")
