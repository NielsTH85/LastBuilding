"""
Explore Last Epoch game data bundles to find item/affix/unique definitions.
"""
import UnityPy
import os
import json

GAME_PATH = r"C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64"

# List all bundles with size
bundles = []
for f in os.listdir(GAME_PATH):
    if f.endswith('.bundle'):
        size = os.path.getsize(os.path.join(GAME_PATH, f))
        bundles.append((f, size))

bundles.sort(key=lambda x: x[0])
print(f"Total bundles: {len(bundles)}")

# Focus on likely candidates for game data
keywords = ['gear', 'item', 'equip', 'affix', 'unique', 'database', 'data', 'ui_', 'game']
print("\n=== Candidate bundles ===")
for name, size in bundles:
    n = name.lower()
    if any(k in n for k in keywords):
        print(f"  {name} ({size // 1024}KB)")

# Explore each candidate for MonoBehaviour / TextAsset / ScriptableObject
candidates = [
    'database_assets_all.bundle',
    'pcg_data_assets_all.bundle',
]

for bundle_name in candidates:
    path = os.path.join(GAME_PATH, bundle_name)
    if not os.path.exists(path):
        continue
    
    print(f"\n=== {bundle_name} ===")
    env = UnityPy.load(path)
    
    # Count by type
    types = {}
    for obj in env.objects:
        t = obj.type.name
        types[t] = types.get(t, 0) + 1
    for t, c in sorted(types.items()):
        print(f"  {t}: {c}")
    
    # List MonoBehaviours with their names
    print(f"\n  MonoBehaviours:")
    count = 0
    for obj in env.objects:
        if obj.type.name == 'MonoBehaviour':
            try:
                data = obj.read()
                name = data.m_Name if hasattr(data, 'm_Name') else '?'
                script = data.m_Script if hasattr(data, 'm_Script') else None
                script_name = ''
                if script:
                    try:
                        s = script.read()
                        script_name = s.m_ClassName if hasattr(s, 'm_ClassName') else s.m_Name if hasattr(s, 'm_Name') else ''
                    except:
                        pass
                if name and (any(k in name.lower() for k in ['unique', 'affix', 'item', 'equip', 'gear', 'base', 'stat', 'prop', 'modifier', 'implicit']) or 
                             any(k in script_name.lower() for k in ['unique', 'affix', 'item', 'equip', 'gear', 'base', 'stat', 'prop', 'modifier', 'implicit'])):
                    print(f"    {name} (script: {script_name})")
                    count += 1
                    if count >= 30:
                        print("    ... (truncated)")
                        break
            except Exception as e:
                pass
    if count == 0:
        print("    (none matched keywords)")
    
    # Check TextAssets
    print(f"\n  TextAssets:")
    for obj in env.objects:
        if obj.type.name == 'TextAsset':
            try:
                data = obj.read()
                name = data.m_Name if hasattr(data, 'm_Name') else '?'
                text = data.m_Script if hasattr(data, 'm_Script') else data.text if hasattr(data, 'text') else ''
                text_str = text if isinstance(text, str) else text.decode('utf-8', errors='replace') if isinstance(text, bytes) else str(text)
                print(f"    {name} ({len(text_str)} chars)")
            except:
                pass
