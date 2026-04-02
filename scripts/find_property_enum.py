import re

js = open('planner_asset.js', 'r', encoding='utf-8').read()

# Find index of DamageTakenAsVoid= 
idx = js.find('DamageTakenAsVoid=')
if idx < 0:
    print("Not found")
    exit()

# Find the start of this enum function block
start = js.rfind('(function', max(0, idx - 5000), idx)
if start < 0:
    start = max(0, idx - 2000)

# Find the end
end = js.find('})', idx)
if end < 0:
    end = idx + 3000
else:
    end += 2

block = js[start:end]
print(f"Block length: {len(block)}")
print(block[:4000])
print("---")
if len(block) > 4000:
    print(block[4000:8000])
