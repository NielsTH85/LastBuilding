"""
Extract item data from game localization and shared data bundles.
These contain the actual affix names, unique names, property names etc.
"""
import UnityPy
import os
import json

GAME_PATH = r"C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64"

# 1. English localization for affix text
en_bundle = os.path.join(GAME_PATH, "localization-string-tables-english(en)_assets_all.bundle")
shared_bundle = os.path.join(GAME_PATH, "localization-assets-shared_assets_all.bundle")

for bundle_path, label in [(en_bundle, "English"), (shared_bundle, "Shared")]:
    print(f"\n=== {label} Bundle ===")
    env = UnityPy.load(bundle_path)
    
    types = {}
    for obj in env.objects:
        t = obj.type.name
        types[t] = types.get(t, 0) + 1
    print(f"Types: {types}")
    
    for obj in env.objects:
        if obj.type.name == 'MonoBehaviour':
            try:
                data = obj.read()
                name = data.m_Name if hasattr(data, 'm_Name') else '?'
                size = obj.byte_size
                
                # Only care about item-related ones
                if 'item' not in name.lower() and 'affix' not in name.lower():
                    continue
                    
                print(f"\n  {name} ({size} bytes)")
                
                # Try to get raw bytes and look for patterns
                raw = obj.get_raw_data() if hasattr(obj, 'get_raw_data') else None
                if raw:
                    text = raw.decode('utf-8', errors='replace')
                    # Find readable strings
                    import re
                    strings = re.findall(r'[\x20-\x7e]{10,}', text)
                    unique_strings = list(set(strings))
                    unique_strings.sort()
                    print(f"    Found {len(unique_strings)} readable strings")
                    # Show some relevant ones
                    for s in unique_strings[:30]:
                        if any(k in s.lower() for k in ['damage', 'health', 'mana', 'armor', 'resist', 'speed', 'ward', 'chance', 'ailment', 'ignite', 'bleed', 'poison', 'chill', 'shock']):
                            print(f"      {s[:120]}")
            except Exception as e:
                print(f"    Error: {e}")
