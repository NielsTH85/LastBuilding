"""
Scan resources.assets and globalgamemanagers.assets for item data.
These are the main Unity asset files that may contain ScriptableObjects.
"""
import UnityPy
import os

GAME_PATH = r"C:\ledata\Last Epoch_Data"

# Check globalgamemanagers.assets first (smaller)
print("=== globalgamemanagers.assets ===")
try:
    env = UnityPy.load(os.path.join(GAME_PATH, "globalgamemanagers.assets"))
    type_counts = {}
    for obj in env.objects:
        tn = obj.type.name
        type_counts[tn] = type_counts.get(tn, 0) + 1
    for t, c in sorted(type_counts.items()):
        print(f"  {t}: {c}")
    
    # Look for MonoBehaviours
    for obj in env.objects:
        if obj.type.name == 'MonoBehaviour':
            try:
                data = obj.read()
                name = data.m_Name if hasattr(data, 'm_Name') else ''
                raw = obj.get_raw_data()
                print(f"  MB: {name} ({len(raw)/1024:.1f}KB)")
            except:
                pass
        elif obj.type.name == 'TextAsset':
            try:
                data = obj.read()
                name = data.m_Name if hasattr(data, 'm_Name') else ''
                print(f"  TextAsset: {name}")
            except:
                pass
except Exception as e:
    print(f"  Error: {e}")

# Now check resources.assets (1GB - just scan types)
print("\n=== resources.assets ===")
try:
    env = UnityPy.load(os.path.join(GAME_PATH, "resources.assets"))
    type_counts = {}
    mb_names = []
    ta_names = []
    for obj in env.objects:
        tn = obj.type.name
        type_counts[tn] = type_counts.get(tn, 0) + 1
        if tn == 'MonoBehaviour':
            try:
                data = obj.read()
                name = data.m_Name if hasattr(data, 'm_Name') else ''
                raw_sz = len(obj.get_raw_data())
                mb_names.append((name, raw_sz))
            except:
                pass
        elif tn == 'TextAsset':
            try:
                data = obj.read()
                name = data.m_Name if hasattr(data, 'm_Name') else ''
                raw_sz = len(obj.get_raw_data())
                ta_names.append((name, raw_sz))
            except:
                pass
    
    for t, c in sorted(type_counts.items()):
        print(f"  {t}: {c}")
    
    # Show MonoBehaviours
    mb_names.sort(key=lambda x: -x[1])
    print(f"\n  MonoBehaviours ({len(mb_names)}):")
    for name, sz in mb_names[:50]:
        print(f"    {sz/1024:.1f}KB  {name}")
    
    # Show TextAssets
    ta_names.sort(key=lambda x: -x[1])
    print(f"\n  TextAssets ({len(ta_names)}):")
    for name, sz in ta_names[:50]:
        print(f"    {sz/1024:.1f}KB  {name}")
    
    # Search for item-related MB names
    print(f"\n  Item-related MonoBehaviours:")
    for name, sz in mb_names:
        lower = name.lower()
        if any(kw in lower for kw in ['item', 'unique', 'affix', 'equip', 'weapon', 'armor', 'base_type', 'prefix', 'suffix', 'modifier', 'property', 'implicit']):
            print(f"    {sz/1024:.1f}KB  {name}")
    
except Exception as e:
    print(f"  Error: {e}")
