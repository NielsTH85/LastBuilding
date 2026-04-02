"""
1. Parse AffixImport CSV fully
2. Look for UniqueList/ItemList MonoBehaviour instances in resources/sharedassets
3. Try to find ItemDataBase or similar large data structures
"""
import UnityPy
import os
import re

GAME_PATH = r"C:\ledata\Last Epoch_Data"

# First, parse AffixImport
env = UnityPy.load(os.path.join(GAME_PATH, "resources.assets"))
for obj in env.objects:
    if obj.type.name == 'TextAsset':
        data = obj.read()
        name = data.m_Name if hasattr(data, 'm_Name') else ''
        if name == 'AffixImport':
            script = data.m_Script
            text = script.decode('utf-8', errors='replace') if isinstance(script, bytes) else str(script)
            lines = text.strip().split('\n')
            print(f"=== AffixImport: {len(lines)} lines ===")
            # Show first 5 lines fully parsed
            for i, line in enumerate(lines[:5]):
                fields = line.split(',')
                print(f"\n  Line {i}: {len(fields)} fields")
                for j, f in enumerate(fields):
                    print(f"    [{j}] = {f}")
            
            # Summary of affix IDs
            ids = []
            for line in lines:
                fields = line.split(',')
                if len(fields) > 4:
                    try:
                        aid = int(fields[4])
                        ids.append(aid)
                    except:
                        pass
            print(f"\n  Affix IDs: {min(ids)} to {max(ids)}, count={len(ids)}")
            
            # Count by type (field[3])
            types = {}
            for line in lines:
                fields = line.split(',')
                if len(fields) > 3:
                    types[fields[3]] = types.get(fields[3], 0) + 1
            print(f"  Types: {types}")
            break

# Now look for ALL MonoBehaviour scripts in resources.assets
# by finding MonoBehaviours that reference specific MonoScripts 
print(f"\n=== Searching for item data MonoBehaviours in resources.assets ===")
mb_count = 0
named_mbs = []
large_mbs = []
for obj in env.objects:
    if obj.type.name == 'MonoBehaviour':
        mb_count += 1
        try:
            data = obj.read()
            name = data.m_Name if hasattr(data, 'm_Name') else ''
            raw_sz = len(obj.get_raw_data())
            if name and raw_sz > 100:
                named_mbs.append((name, raw_sz))
            if raw_sz > 5000:  # Only look at >5KB
                large_mbs.append((name, raw_sz, obj))
        except:
            pass

print(f"Total MBs: {mb_count}, named: {len(named_mbs)}, >5KB: {len(large_mbs)}")
named_mbs.sort(key=lambda x: -x[1])
print(f"\nAll named MBs >100B (by size):")
for name, sz in named_mbs[:30]:
    print(f"  {sz/1024:.1f}KB  {name}")

print(f"\nLarge MBs >5KB:")
large_mbs.sort(key=lambda x: -x[1])
for name, sz, obj in large_mbs[:20]:
    raw = obj.get_raw_data()
    strings = re.findall(rb'[\x20-\x7e]{4,}', raw)
    top_strings = [s.decode('ascii') for s in strings[:20]]
    print(f"  {sz/1024:.1f}KB  '{name}' strings={len(strings)}: {top_strings[:5]}")

# Also check sharedassets1.assets (100MB)
print(f"\n=== Scanning sharedassets1.assets for item data ===")
env2 = UnityPy.load(os.path.join(GAME_PATH, "sharedassets1.assets"))
type_counts2 = {}
for obj in env2.objects:
    tn = obj.type.name
    type_counts2[tn] = type_counts2.get(tn, 0) + 1
print(f"Types: {dict(sorted(type_counts2.items()))}")

mb_count2 = 0
named_mbs2 = []
for obj in env2.objects:
    if obj.type.name == 'MonoBehaviour':
        mb_count2 += 1
        try:
            data = obj.read() 
            name = data.m_Name if hasattr(data, 'm_Name') else ''
            raw_sz = len(obj.get_raw_data())
            if name and raw_sz > 100:
                named_mbs2.append((name, raw_sz))
        except:
            pass

named_mbs2.sort(key=lambda x: -x[1])
print(f"MBs: {mb_count2}, named: {len(named_mbs2)}")
for name, sz in named_mbs2[:30]:
    print(f"  {sz/1024:.1f}KB  {name}")
