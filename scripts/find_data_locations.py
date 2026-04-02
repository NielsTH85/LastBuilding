"""
Check addressable catalog and other potential item data locations.
"""
import os
import json
import re

GAME_PATH = r"C:\ledata\Last Epoch_Data"
AA_PATH = os.path.join(GAME_PATH, "StreamingAssets", "aa")
WIN_PATH = os.path.join(AA_PATH, "StandaloneWindows64")

# Check for catalog files
print("=== Addressable catalog files ===")
for root, dirs, files in os.walk(AA_PATH):
    for f in files:
        if 'catalog' in f.lower() or f.endswith('.json') or f.endswith('.hash'):
            fp = os.path.join(root, f)
            sz = os.path.getsize(fp)
            print(f"  {sz/1024:.1f}KB  {os.path.relpath(fp, AA_PATH)}")
            if f.endswith('.json') and sz < 5000000:
                try:
                    with open(fp, 'r') as fh:
                        data = json.load(fh)
                        if isinstance(data, dict):
                            print(f"    Keys: {list(data.keys())[:10]}")
                            # Look for item-related entries
                            text = json.dumps(data)
                            if 'item' in text.lower()[:10000] or 'unique' in text.lower()[:10000]:
                                print(f"    Contains item/unique references!")
                except:
                    pass

# Check Resources folder
print("\n=== Resources folder ===")
res_path = os.path.join(GAME_PATH, "Resources")
if os.path.exists(res_path):
    for f in os.listdir(res_path):
        fp = os.path.join(res_path, f)
        sz = os.path.getsize(fp) if os.path.isfile(fp) else 0
        print(f"  {sz/1024:.1f}KB  {f}")

# Check for any .json, .bytes, .xml, .csv data files
print("\n=== Data files in StreamingAssets ===")
for root, dirs, files in os.walk(os.path.join(GAME_PATH, "StreamingAssets")):
    for f in files:
        if f.endswith(('.json', '.bytes', '.xml', '.csv', '.txt', '.dat', '.db', '.sqlite')):
            fp = os.path.join(root, f)
            sz = os.path.getsize(fp)
            print(f"  {sz/1024:.1f}KB  {os.path.relpath(fp, GAME_PATH)}")

# Check level files and globalgamemanagers
print("\n=== Root data files ===")
for f in os.listdir(GAME_PATH):
    if os.path.isfile(os.path.join(GAME_PATH, f)):
        sz = os.path.getsize(os.path.join(GAME_PATH, f))
        print(f"  {sz/1024:.1f}KB  {f}")

# Check il2cpp metadata
print("\n=== IL2CPP data ===")
il2cpp_path = os.path.join(GAME_PATH, "il2cpp_data")
if os.path.exists(il2cpp_path):
    for root, dirs, files in os.walk(il2cpp_path):
        for f in files:
            fp = os.path.join(root, f)
            sz = os.path.getsize(fp)
            rel = os.path.relpath(fp, il2cpp_path)
            print(f"  {sz/1024:.1f}KB  {rel}")
