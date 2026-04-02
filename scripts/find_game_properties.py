"""
Try to find property definitions in Last Epoch game data using UnityPy.
"""
import UnityPy
import json
import os

GAME_PATH = r"C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64"

# Look for bundles that might contain stat/property definitions
# The gameplay bundles are most likely
candidates = []
for f in os.listdir(GAME_PATH):
    if f.endswith('.bundle') and ('gameplay' in f.lower() or 'gear' in f.lower() or 'ui' in f.lower() or 'data' in f.lower()):
        candidates.append(f)

print(f"Candidate bundles: {len(candidates)}")
for c in sorted(candidates)[:20]:
    size_kb = os.path.getsize(os.path.join(GAME_PATH, c)) // 1024
    print(f"  {c} ({size_kb}KB)")

# Try the gear gameplay bundle first
target = os.path.join(GAME_PATH, "gear-sprites_visuals_assets_all.bundle")
# Actually let's try to find a bundle with "property" or "stat" data
# Let's look at the player gameplay bundle
for bundle_name in ['actors_player_gameplay_assets_all.bundle', 
                     'actors_player_specific_gameplay_assets_all.bundle',
                     'gear-sprites_visuals_assets_all.bundle']:
    bundle_path = os.path.join(GAME_PATH, bundle_name)
    if not os.path.exists(bundle_path):
        continue
    
    env = UnityPy.load(bundle_path)
    print(f"\n{bundle_name}: {len(env.objects)} objects")
    
    # Count by type
    types = {}
    for obj in env.objects:
        t = obj.type.name
        types[t] = types.get(t, 0) + 1
    
    for t, c in sorted(types.items()):
        print(f"  {t}: {c}")
    
    # Check MonoBehaviours for property-related data
    for obj in env.objects:
        if obj.type.name == "MonoBehaviour":
            try:
                data = obj.read()
                tree = data.read_typetree()
                if tree:
                    keys = list(tree.keys()) if isinstance(tree, dict) else []
                    text = str(tree)[:500]
                    if any(k in text.lower() for k in ['property', 'stat', 'affix', 'modifier']):
                        print(f"\n  Found relevant MonoBehaviour: keys={keys[:10]}")
                        print(f"  Preview: {text[:300]}")
            except Exception as e:
                pass
