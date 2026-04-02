"""
Deep scan all bundles in game data for MonoBehaviours with item-related names.
Focus on finding UniqueList, AffixList, ItemBaseList, etc.
"""
import UnityPy
import os

GAME_PATH = r"C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64"

# Scan ALL bundles
bundles = sorted(f for f in os.listdir(GAME_PATH) if f.endswith('.bundle'))

# Keywords that indicate item data
ITEM_KEYWORDS = ['unique', 'affix', 'itembase', 'baseitem', 'equipmentdata', 
                 'itemdata', 'geardata', 'loot', 'implicit', 'weapondata',
                 'armordata', 'itemlist', 'uniquelist', 'affixlist',
                 'equipmentlist', 'baselist', 'itemclass', 'itemtype',
                 'subitem', 'setitem', 'legendaryitem']

SCRIPT_KEYWORDS = ['UniqueList', 'AffixList', 'ItemList', 'UniqueInfo',
                   'AffixInfo', 'ItemInfo', 'EquipmentData', 'ItemData',
                   'UniqueData', 'AffixData', 'BaseTypeData', 'SubItemData',
                   'SubTypeData', 'EquipmentClass', 'ItemClass']

found = []

for bundle_name in bundles:
    path = os.path.join(GAME_PATH, bundle_name)
    size = os.path.getsize(path)
    # Skip very large visual bundles
    if size > 200_000_000:
        continue
    
    try:
        env = UnityPy.load(path)
    except:
        continue
    
    for obj in env.objects:
        if obj.type.name == 'MonoBehaviour':
            try:
                data = obj.read()
                name = (data.m_Name if hasattr(data, 'm_Name') else '') or ''
                
                script = data.m_Script if hasattr(data, 'm_Script') else None
                script_name = ''
                if script:
                    try:
                        s = script.read()
                        script_name = s.m_ClassName if hasattr(s, 'm_ClassName') else s.m_Name if hasattr(s, 'm_Name') else ''
                    except:
                        pass
                
                name_lower = name.lower()
                script_lower = script_name.lower()
                
                if any(k in name_lower for k in ITEM_KEYWORDS) or any(k.lower() in script_lower for k in SCRIPT_KEYWORDS):
                    found.append({
                        'bundle': bundle_name,
                        'name': name,
                        'script': script_name,
                        'obj_size': obj.byte_size,
                    })
            except:
                pass

print(f"\nFound {len(found)} relevant MonoBehaviours:")
for f in sorted(found, key=lambda x: -x['obj_size']):
    print(f"  [{f['bundle']}] {f['name']} (script: {f['script']}) - {f['obj_size']} bytes")
