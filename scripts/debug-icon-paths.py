import json

with open(r'c:\eob\packages\game-data\src\data\maxroll-import.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

import os
icons_dir = r'C:\eob\apps\planner-web\public\icons\all'
all_icons = set(os.listdir(icons_dir))

# Check what paths getNodeIcon would generate for passive nodes
def slug(name):
    import re
    s = name.lower()
    s = s.replace("'", "")
    s = re.sub(r'[^a-z0-9]+', '-', s)
    s = s.strip('-')
    return f'skillicon-{s}.png'

print("=== MAGE BASE PASSIVES ===")
for n in data['passives']['baseMage']:
    expected = slug(n['name'])
    exists = expected in all_icons
    print(f"  {n['name']:30s} -> {expected:50s} {'OK' if exists else 'MISSING'}")

print("\n=== RUNEMASTER PASSIVES ===")
for n in data['passives']['runemaster']:
    expected = slug(n['name'])
    exists = expected in all_icons
    print(f"  {n['name']:30s} -> {expected:50s} {'OK' if exists else 'MISSING'}")

print("\n=== SKILL ROOT NODES ===")
for group in ['mageBase', 'runemaster']:
    for s in data['skills'][group]:
        # skillIdFromAbilityKey equivalent
        import re
        sk_id = re.sub(r'^Runemaster \d+[a-z]?\d?\s*', '', s['abilityKey'])
        sk_id = sk_id.replace(' ', '-').lower()
        
        skill_map = {
            "lightning-blast": "skillicon-lightning-bolt.png",
            "fireball": "skillicon-fireball.png",
            "snap-freeze": "skillicon-snap-freeze.png",
            "elemental-nova": "skillicon-elemental-nova.png",
            "mana-strike": "skillicon-mana-strike.png",
            "flame-ward": "skillicon-flame_ward.png",
            "teleport": "skillicon-teleport.png",
            "frost-claw": "skillicon-frost-claw.png",
            "static": "skillicon-static.png",
            "runic-invocation": "skillicon-runic-invocation.png",
            "flame-rush": "skillicon-flame-rush.png",
            "frost-wall": "skillicon-frost-wall.png",
            "runebolt": "skillicon-runebolt-fire.png",
            "glyph-of-dominion": "skillicon-glyph-of-dominion.png",
        }
        icon = skill_map.get(sk_id, slug(s['name']))
        exists = icon in all_icons
        print(f"  {sk_id:25s} ({s['name']:20s}) -> {icon:50s} {'OK' if exists else 'MISSING'}")
