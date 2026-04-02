"""
Find MonoBehaviours that reference key data scripts (UniqueList, AffixList, ItemList).
In Unity serialization, each MonoBehaviour has m_Script PPtr that references the MonoScript.
We can match these to find data instances.
"""
import UnityPy
import os
import struct
import re

GAME_PATH = r"C:\ledata\Last Epoch_Data"

# First, find the path_id of key MonoScripts
print("=== Finding MonoScript path IDs ===")
env_ggm = UnityPy.load(os.path.join(GAME_PATH, "globalgamemanagers.assets"))
target_scripts = {}
for obj in env_ggm.objects:
    if obj.type.name == 'MonoScript':
        try:
            data = obj.read()
            name = data.m_Name if hasattr(data, 'm_Name') else ''
            if name in ['UniqueList', 'AffixList', 'ItemList', 'ItemData', 'ItemDataUnpacked', 
                        'LoadItemDatabase', 'UniqueItemMod', 'UniqueItemComponent',
                        'Item', 'ItemFactory', 'CreateCustomItem', 'InventoryItem',
                        'DefaultItems', 'GenerateItems', 'BasePropertyInfo',
                        'PlayerPropertyList', 'AbilityPropertyList', 'PropertyList',
                        'EquipmentType']:
                target_scripts[name] = obj.path_id
                print(f"  {name}: path_id={obj.path_id}")
        except:
            pass

# Now search for MonoBehaviours in ALL sharedassets and resources that reference these scripts
print(f"\n=== Searching for script references in resources.assets ===")
env_res = UnityPy.load(os.path.join(GAME_PATH, "resources.assets"))

target_pids = set(target_scripts.values())
found_instances = []

for obj in env_res.objects:
    if obj.type.name == 'MonoBehaviour':
        try:
            raw = obj.get_raw_data()
            # MonoBehaviour serialization format:
            # m_GameObject: PPtr<GameObject> = file_id (4 bytes) + path_id (8 bytes) = 12 bytes
            # m_Enabled: uint8 aligned to 4 = 4 bytes  
            # m_Script: PPtr<MonoScript> = file_id (4 bytes) + path_id (8 bytes) = 12 bytes
            # m_Name: string = length (4 bytes) + chars + align
            
            if len(raw) < 28:
                continue
            
            # Read m_Script PPtr (offset 16)
            script_file_id = struct.unpack_from('<i', raw, 16)[0]
            script_path_id = struct.unpack_from('<q', raw, 20)[0]
            
            if script_path_id in target_pids:
                # Found one!
                script_name = [k for k, v in target_scripts.items() if v == script_path_id][0]
                found_instances.append((script_name, len(raw), obj, raw))
                print(f"  Found {script_name} instance: {len(raw)} bytes, path_id={obj.path_id}")
                
                # Show hex dump of data
                print(f"    First 100 bytes of data:")
                for off in range(0, min(100, len(raw)), 16):
                    hex_part = ' '.join(f'{b:02x}' for b in raw[off:off+16])
                    ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in raw[off:off+16])
                    print(f"    {off:4d}: {hex_part:<48s} {ascii_part}")

        except Exception as e:
            pass

if not found_instances:
    print("  No instances found in resources.assets")
    
    # Also check level0 and level1 (initial scene data)
    print(f"\n  Checking first few level files...")
    for i in [0, 1, 2, 3]:
        fp = os.path.join(GAME_PATH, f"level{i}")
        if not os.path.exists(fp):
            continue
        try:
            env_lvl = UnityPy.load(fp)
            for obj in env_lvl.objects:
                if obj.type.name == 'MonoBehaviour':
                    raw = obj.get_raw_data()
                    if len(raw) < 28:
                        continue
                    script_path_id = struct.unpack_from('<q', raw, 20)[0]
                    if script_path_id in target_pids:
                        script_name = [k for k, v in target_scripts.items() if v == script_path_id][0]
                        print(f"  Found {script_name} in level{i}: {len(raw)} bytes")
        except:
            pass

# Also list ALL MonoBehaviours in resources.assets by their script references
print(f"\n=== Script reference distribution in resources.assets ===")
script_refs = {}
for obj in env_res.objects:
    if obj.type.name == 'MonoBehaviour':
        try:
            raw = obj.get_raw_data()
            if len(raw) >= 28:
                script_file_id = struct.unpack_from('<i', raw, 16)[0]
                script_path_id = struct.unpack_from('<q', raw, 20)[0]
                key = (script_file_id, script_path_id)
                if key not in script_refs:
                    script_refs[key] = {'count': 0, 'total_size': 0, 'max_size': 0}
                script_refs[key]['count'] += 1
                script_refs[key]['total_size'] += len(raw)
                script_refs[key]['max_size'] = max(script_refs[key]['max_size'], len(raw))
        except:
            pass

# Sort by total size
sorted_refs = sorted(script_refs.items(), key=lambda x: -x[1]['total_size'])
print(f"\nTop 30 script references (by total data size):")
for (fid, pid), info in sorted_refs[:30]:
    # Look up script name
    sname = target_scripts.get(pid, f"pid={pid}")
    if sname.startswith("pid="):
        # Try to look up in MonoScripts
        for obj2 in env_ggm.objects:
            if obj2.type.name == 'MonoScript' and obj2.path_id == pid:
                try:
                    d = obj2.read()
                    sname = d.m_Name
                except:
                    pass
                break
    print(f"  fid={fid} {sname}: count={info['count']}, total={info['total_size']/1024:.1f}KB, max={info['max_size']}B")
