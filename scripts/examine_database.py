"""
Deep dive into database_assets_all.bundle - examine all 596 MonoBehaviours
to find item definitions with numeric data.
"""
import UnityPy
import os
import re
import struct
import json

GAME_PATH = r"C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64"
bundle = os.path.join(GAME_PATH, "database_assets_all.bundle")

env = UnityPy.load(bundle)

# Collect all MonoBehaviours with their names and sizes
mbs = []
for obj in env.objects:
    if obj.type.name == 'MonoBehaviour':
        try:
            data = obj.read()
            name = data.m_Name if hasattr(data, 'm_Name') else ''
            raw = obj.get_raw_data()
            mbs.append((name, len(raw), obj, raw))
        except:
            pass

print(f"Total MonoBehaviours: {len(mbs)}")
mbs.sort(key=lambda x: -x[1])

# Show all by size (there may be item databases hidden among the MTX items)
print(f"\n=== All MonoBehaviours by size ===")
for name, sz, obj, raw in mbs[:100]:
    print(f"  {sz/1024:.1f}KB  {name}")

# Look for ANY MB with "item" or "unique" or "affix" or "equipment" in name
print(f"\n=== Item-related names ===")
for name, sz, obj, raw in mbs:
    lower = name.lower()
    if any(kw in lower for kw in ['item', 'unique', 'affix', 'equip', 'weapon', 'armor', 'armour', 'ring', 'amulet', 'relic', 'helmet', 'boot', 'glove', 'belt', 'shield', 'quiver', 'idol', 'base_type', 'subtype', 'implicit', 'prefix', 'suffix', 'modifier', 'property']):
        print(f"  {sz/1024:.1f}KB  {name}")

# Look at the LARGEST MBs more carefully - examine their binary structure
print(f"\n=== Examining top 10 largest MBs ===")
for name, sz, obj, raw in mbs[:10]:
    strings = re.findall(rb'[\x20-\x7e]{6,}', raw)
    # Look for field names or identifiers
    interesting = [s.decode('ascii') for s in strings if any(kw in s.lower() for kw in [b'property', b'modifier', b'affix', b'item', b'stat', b'damage', b'health', b'armor', b'resist', b'speed', b'mana', b'ward', b'dodge', b'block', b'crit'])]
    print(f"\n  {name} ({sz/1024:.1f}KB): {len(strings)} strings, {len(interesting)} item-related")
    for s in interesting[:10]:
        print(f"    {s}")

# Check if any MBs have type tree info that reveals their class
print(f"\n=== Checking type trees ===")
for name, sz, obj, raw in mbs[:20]:
    try:
        # Try to read with type tree
        data = obj.read()
        # Check if it has typed data beyond m_Name
        attrs = [a for a in dir(data) if not a.startswith('_') and a != 'm_Name' and a != 'm_Script' and a != 'm_GameObject' and a != 'm_Enabled']
        typed_attrs = [a for a in attrs if not callable(getattr(data, a, None))]
        if typed_attrs:
            print(f"  {name}: {typed_attrs[:10]}")
    except:
        pass

# Also check for TextAsset objects
print(f"\n=== TextAssets in database bundle ===")
for obj in env.objects:
    if obj.type.name == 'TextAsset':
        try:
            data = obj.read()
            name = data.m_Name if hasattr(data, 'm_Name') else ''
            raw = obj.get_raw_data()
            print(f"  {name} ({len(raw)/1024:.1f}KB)")
            # Show first few bytes
            preview = raw[:200].decode('utf-8', errors='replace')
            print(f"    Preview: {preview[:100]}")
        except:
            pass
