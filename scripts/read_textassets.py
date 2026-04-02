"""
Read interesting TextAssets from resources.assets:
- AffixImport (21.4KB) - likely affix data!
- A-Tier, S-Tier, B-Tier - likely tier data
Also search MonoScript names for item-related classes.
"""
import UnityPy
import os
import json

GAME_PATH = r"C:\ledata\Last Epoch_Data"

env = UnityPy.load(os.path.join(GAME_PATH, "resources.assets"))

# Read specific TextAssets
target_names = ['AffixImport', 'A-Tier', 'S-Tier', 'B-Tier', 'ZendeskFields']
for obj in env.objects:
    if obj.type.name == 'TextAsset':
        try:
            data = obj.read()
            name = data.m_Name if hasattr(data, 'm_Name') else ''
            if name in target_names:
                # Get the script content
                script = data.m_Script
                if isinstance(script, bytes):
                    text = script.decode('utf-8', errors='replace')
                else:
                    text = str(script)
                
                print(f"\n{'='*60}")
                print(f"=== {name} ({len(text)} chars) ===")
                print(f"{'='*60}")
                # Show first 3000 chars
                print(text[:3000])
                if len(text) > 3000:
                    print(f"\n... ({len(text) - 3000} more chars)")
        except Exception as e:
            print(f"Error reading {name}: {e}")

# Now search MonoScript names for item-related classes
print(f"\n{'='*60}")
print(f"=== Item-related MonoScripts ===")
print(f"{'='*60}")
env2 = UnityPy.load(os.path.join(GAME_PATH, "globalgamemanagers.assets"))
item_scripts = []
for obj in env2.objects:
    if obj.type.name == 'MonoScript':
        try:
            data = obj.read()
            name = data.m_Name if hasattr(data, 'm_Name') else ''
            namespace = data.m_Namespace if hasattr(data, 'm_Namespace') else ''
            lower = name.lower()
            if any(kw in lower for kw in ['item', 'unique', 'affix', 'equip', 'weapon', 'armor', 'armour',
                                           'basetype', 'subtype', 'implicit', 'prefix', 'suffix', 'modifier',
                                           'property', 'loot', 'inventory', 'craft', 'forge']):
                item_scripts.append((namespace, name))
        except:
            pass

item_scripts.sort()
for ns, name in item_scripts:
    print(f"  {ns}.{name}" if ns else f"  {name}")
