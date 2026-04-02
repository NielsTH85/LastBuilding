"""
Try to use UnityPy's type tree reading capabilities on UniqueList.
Also cross-reference with our existing maxroll data to decode the format.
"""
import UnityPy
import os
import struct
import json

GAME_PATH = r"C:\ledata\Last Epoch_Data"

# Load our existing maxroll data for cross-reference
with open(r'c:\eob\packages\game-data\src\data\uniques-import.json', 'r') as f:
    maxroll_data = json.load(f)

# Find Calamity in maxroll data
for item in maxroll_data:
    if item.get('name') == 'Calamity':
        print("=== Calamity from maxroll ===")
        print(json.dumps(item, indent=2)[:2000])
        break

env = UnityPy.load(os.path.join(GAME_PATH, "resources.assets"))

for obj in env.objects:
    if obj.type.name == 'MonoBehaviour':
        raw = obj.get_raw_data()
        if len(raw) >= 28:
            script_path_id = struct.unpack_from('<q', raw, 20)[0]
            if script_path_id == 9668:  # UniqueList
                # Try typetree
                print("\n=== Trying type tree methods ===")
                try:
                    tree = obj.read_typetree()
                    print(f"TypeTree read success! Type: {type(tree)}")
                    if isinstance(tree, dict):
                        print(f"Keys: {list(tree.keys())[:20]}")
                        # Show structure
                        for k, v in tree.items():
                            if isinstance(v, list) and len(v) > 0:
                                print(f"\n  {k}: list of {len(v)} items")
                                if isinstance(v[0], dict):
                                    print(f"    First item keys: {list(v[0].keys())[:20]}")
                                    print(f"    First item: {json.dumps(v[0], indent=2, default=str)[:500]}")
                                    if len(v) > 1:
                                        print(f"\n    Second item: {json.dumps(v[1], indent=2, default=str)[:500]}")
                                else:
                                    print(f"    First item: {v[0]}")
                            elif isinstance(v, dict):
                                print(f"\n  {k}: dict with keys {list(v.keys())[:10]}")
                            else:
                                print(f"  {k}: {v}")
                except Exception as e:
                    print(f"TypeTree failed: {e}")
                    
                    # Try alternative reading
                    try:
                        data = obj.read()
                        # Check available attributes
                        attrs = [a for a in dir(data) if not a.startswith('_')]
                        print(f"\nAvailable attrs: {attrs}")
                        
                        # Try serialization data
                        if hasattr(data, 'serializationData'):
                            sd = data.serializationData
                            print(f"\nSerialization data type: {type(sd)}")
                            if isinstance(sd, dict):
                                print(f"Keys: {list(sd.keys())[:10]}")
                    except Exception as e2:
                        print(f"Alternative read failed: {e2}")
                
                break
