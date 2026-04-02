"""
Extract all strings from localization shared data for items.
"""
import UnityPy
import os
import re
import json

GAME_PATH = r"C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64"

shared_bundle = os.path.join(GAME_PATH, "localization-assets-shared_assets_all.bundle")
en_bundle = os.path.join(GAME_PATH, "localization-string-tables-english(en)_assets_all.bundle")

# Extract from shared
env = UnityPy.load(shared_bundle)
for obj in env.objects:
    if obj.type.name == 'MonoBehaviour':
        data = obj.read()
        name = data.m_Name if hasattr(data, 'm_Name') else ''
        if 'Item_Names' in name:
            raw = obj.get_raw_data()
            text = raw.decode('utf-8', errors='replace')
            strings = re.findall(r'[\x20-\x7e]{4,}', text)
            
            # Look for unique item entries 
            unique_names = [s for s in strings if 'Unique_' in s or 'unique_' in s.lower()]
            print(f"=== {name}: {len(strings)} strings, {len(unique_names)} with 'Unique_' ===")
            for s in unique_names[:40]:
                print(f"  {s[:150]}")
            
            # Look for key patterns
            print(f"\n  --- Set item entries ---")
            set_entries = [s for s in strings if 'ItemSet_' in s]
            for s in set_entries[:20]:
                print(f"  {s[:150]}")
                
            print(f"\n  --- Sample other entries ---")
            other = [s for s in strings if not s.startswith(' ') and '_' in s and len(s) > 10]
            for s in other[:40]:
                print(f"  {s[:150]}")
            break

# Now check English for unique names
env2 = UnityPy.load(en_bundle)
for obj in env2.objects:
    if obj.type.name == 'MonoBehaviour':
        data = obj.read()
        name = data.m_Name if hasattr(data, 'm_Name') else ''
        if 'Item_Names' in name:
            raw = obj.get_raw_data()
            text = raw.decode('utf-8', errors='replace')
            strings = re.findall(r'[\x20-\x7e]{4,}', text)
            
            unique_names = [s for s in strings if 'Unique' in s or 'Ladle' in s or 'Calamity' in s]
            print(f"\n=== English {name}: {len(strings)} strings ===")
            for s in unique_names[:40]:
                print(f"  {s[:150]}")
            
            # Find lore text
            lore = [s for s in strings if len(s) > 40 and any(c in s for c in ['"', '...', 'was', 'the', 'ancient'])]
            print(f"\n  --- Possible lore text ({len(lore)} entries) ---")
            for s in lore[:15]:
                print(f"  {s[:150]}")
            break
