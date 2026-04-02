import json
d = json.load(open(r'c:\eob\packages\game-data\src\data\maxroll-import.json', encoding='utf-8'))

base_mage = d['passives']['baseMage']
print(f"baseMage nodes: {len(base_mage)}")
for n in base_mage[:5]:
    nid = n["nodeId"]
    name = n["name"]
    icon = n.get("icon")
    print(f"  id={nid}, name={name}, icon={icon}")

print()
skills = d['skills']['mageBase']
print(f"mageBase skills: {len(skills)}")
s0 = skills[0]
print(f"Skill: {s0['name']}, nodes: {len(s0['nodes'])}")
for n in s0['nodes'][:3]:
    nid = n["nodeId"]
    name = n["name"]
    icon = n.get("icon")
    print(f"  id={nid}, name={name}, icon={icon}")
