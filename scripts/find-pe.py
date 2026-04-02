import re

js = open(r'c:\eob\scripts\planner_asset.js', 'r', encoding='utf-8').read()

# Find the function that builds the tree and contains t.x/pe
idx = js.find('t.x/pe')
# Get a large chunk around it to understand the context  
chunk = js[max(0,idx-3000):idx+1000]

# Find all single-letter variable=number assignments in this chunk
assignments = re.findall(r'[,;({\s]([a-zA-Z_]\w{0,3})\s*=\s*(\d+(?:\.\d+)?)\b', chunk)
print("Variable assignments near t.x/pe:")
for name, val in assignments:
    if len(name) <= 2:
        print(f"  {name} = {val}")

# Also search the whole file for pe=number
print("\nGlobal pe assignments:")
for m in re.finditer(r'[^a-zA-Z_]pe\s*=\s*(\d+(?:\.\d+)?)', js):
    print(f"  pe = {m.group(1)} at position {m.start()}")

# Look for the tree node rendering - the function around this code
# Find the module/function scope
print("\nContext (500 chars before t.x/pe):")
print(js[max(0,idx-500):idx+300])
