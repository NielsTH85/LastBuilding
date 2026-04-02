"""
Deep scan ALL bundles for non-localization item data.
Look for MonoBehaviours, ScriptableObjects, TextAssets, and other asset types
that might contain item definitions with numeric data.
"""
import UnityPy
import os
import struct

GAME_PATH = r"C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64"

# Get all bundle files sorted by size (largest first)
bundles = []
for f in os.listdir(GAME_PATH):
    if f.endswith('.bundle'):
        fp = os.path.join(GAME_PATH, f)
        sz = os.path.getsize(fp)
        bundles.append((f, sz))

bundles.sort(key=lambda x: -x[1])

print(f"Total bundles: {len(bundles)}")
print(f"\n=== Top 30 bundles by size ===")
for name, sz in bundles[:30]:
    print(f"  {sz/1024/1024:.1f} MB  {name}")

# Now scan all bundles for ALL asset types
print(f"\n=== Scanning all bundles for asset types ===")
for name, sz in bundles:
    if sz > 500 * 1024 * 1024:  # Skip >500MB
        continue
    if 'localization' in name:  # Already explored
        continue
    
    try:
        env = UnityPy.load(os.path.join(GAME_PATH, name))
        type_counts = {}
        for obj in env.objects:
            tn = obj.type.name
            type_counts[tn] = type_counts.get(tn, 0) + 1
        
        # Only print if it has interesting types (not just textures/meshes)
        interesting = {k: v for k, v in type_counts.items() 
                      if k in ('MonoBehaviour', 'TextAsset', 'MonoScript', 'AnimationClip')}
        if interesting:
            print(f"\n  {name} ({sz/1024:.0f}KB):")
            for t, c in sorted(type_counts.items()):
                print(f"    {t}: {c}")
            
            # List MB names
            for obj in env.objects:
                if obj.type.name == 'MonoBehaviour':
                    try:
                        data = obj.read()
                        mname = data.m_Name if hasattr(data, 'm_Name') else '?'
                        raw_sz = len(obj.get_raw_data())
                        if raw_sz > 1000:  # Only show significant ones
                            print(f"    MB: {mname} ({raw_sz/1024:.1f}KB)")
                    except:
                        pass
                elif obj.type.name == 'TextAsset':
                    try:
                        data = obj.read()
                        mname = data.m_Name if hasattr(data, 'm_Name') else '?'
                        raw_sz = len(obj.get_raw_data())
                        print(f"    TextAsset: {mname} ({raw_sz/1024:.1f}KB)")
                    except:
                        pass
    except Exception as e:
        pass
