"""Analyze post-mod structure with hypothesis: desc_count, then desc_count*(string+2ints), lore, 7 footer ints."""
import struct
import json

with open(r'c:\eob\scripts\uniquelist.bin', 'rb') as f:
    raw = f.read()

with open(r'c:\eob\packages\game-data\src\data\uniques-import.json', 'r') as f:
    maxroll_data = json.load(f)

def read_string(raw, pos):
    if pos + 4 > len(raw):
        return None, pos
    strlen = struct.unpack_from('<i', raw, pos)[0]
    if strlen < 0 or strlen > 50000 or pos + 4 + strlen > len(raw):
        return None, pos
    try:
        s = raw[pos+4:pos+4+strlen].decode('utf-8')
    except:
        return None, pos
    next_pos = pos + 4 + strlen
    next_pos = (next_pos + 3) & ~3
    return s, next_pos

def parse_entry(raw, pos):
    """Parse a complete entry including post-mod data. Returns (entry, next_pos)."""
    start = pos
    
    # 1. Name
    name, pos = read_string(raw, pos)
    if name is None:
        return None, start
    
    # 2. Display name
    display_name, pos = read_string(raw, pos)
    if display_name is None:
        return None, start
    
    # 3. Header (152 bytes)
    if pos + 152 > len(raw):
        return None, start
    uid = struct.unpack_from('<i', raw, pos + 4)[0]
    lvl = struct.unpack_from('<i', raw, pos + 56)[0]
    header_ints = [struct.unpack_from('<i', raw, pos + i*4)[0] for i in range(38)]
    pos += 152
    
    # 4. Mod count + mods
    mod_count = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if mod_count < 0 or mod_count > 30:
        return None, start
    
    mods = []
    for m in range(mod_count):
        if pos + 40 > len(raw):
            return None, start
        fields = struct.unpack_from('<fiifiiiiii', raw, pos)
        mods.append({
            'value': round(fields[0], 6),
            'canRoll': fields[1],
            'modCategory': fields[2],
            'maxValue': round(fields[3], 6),
            'property': fields[4],
            'specialTag': fields[5],
            'tags': fields[6],
            'unknown_a': fields[7],
            'displayType': fields[8],  # THIS is the actual flat/increased/more type
            'unknown_c': fields[9],
        })
        pos += 40
    
    # 5. Post-mod: desc_count
    desc_count = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    
    if desc_count < 0 or desc_count > 50:
        return None, start
    
    # 6. Descriptions: each is (string, int, int)
    descriptions = []
    for i in range(desc_count):
        s, pos = read_string(raw, pos)
        if s is None:
            return None, start
        i1 = struct.unpack_from('<i', raw, pos)[0]
        i2 = struct.unpack_from('<i', raw, pos + 4)[0]
        pos += 8
        descriptions.append({'text': s, 'field1': i1, 'field2': i2})
    
    # 7. Lore string
    lore, pos = read_string(raw, pos)
    if lore is None:
        return None, start
    
    # 8. Footer: try 7 ints
    if pos + 28 > len(raw):
        return None, start
    footer = [struct.unpack_from('<i', raw, pos + i*4)[0] for i in range(7)]
    pos += 28
    
    return {
        'name': name,
        'displayName': display_name,
        'uid': uid,
        'level': lvl,
        'header_ints': header_ints,
        'mods': mods,
        'desc_count': desc_count,
        'descriptions': descriptions,
        'lore': lore,
        'footer': footer,
    }, pos


# Parse ALL entries
pos = 48
entries = []
for i in range(471):
    entry, next_pos = parse_entry(raw, pos)
    if entry is None:
        print(f"FAILED at entry {i}, pos {pos}")
        # Dump some context
        for j in range(10):
            if pos + j*4 + 4 <= len(raw):
                val = struct.unpack_from('<i', raw, pos + j*4)[0]
                print(f"  pos {pos + j*4}: int={val}")
        break
    entries.append(entry)
    pos = next_pos

print(f"Successfully parsed {len(entries)} / 471 entries")

# Show first 10 entries
for entry in entries[:15]:
    uid = entry['uid']
    print(f"\n[{uid}] {entry['name']}" +
          (f" / {entry['displayName']}" if entry['displayName'] != entry['name'] else ""))
    print(f"  Level: {entry['level']}")
    for i, mod in enumerate(entry['mods']):
        print(f"  Mod {i}: prop={mod['property']} val={mod['value']:.4f}-{mod['maxValue']:.4f} "
              f"dispType={mod['displayType']} cat={mod['modCategory']} tags={mod['tags']} special={mod['specialTag']}")
    print(f"  Descriptions ({entry['desc_count']}):")
    for d in entry['descriptions']:
        print(f"    '{d['text'][:70]}' f1={d['field1']} f2={d['field2']}")
    print(f"  Lore: '{entry['lore'][:70]}'")
    print(f"  Footer: {entry['footer']}")

# Verify displayType matches maxroll type
maxroll_by_id = {item['uniqueID']: item for item in maxroll_data}
type_matches = 0
type_mismatches = 0
for entry in entries:
    mx = maxroll_by_id.get(entry['uid'])
    if not mx:
        continue
    mx_mods = mx.get('mods', [])
    for gm, mm in zip(entry['mods'], mx_mods):
        mx_type = mm.get('type', 0)
        if gm['displayType'] == mx_type:
            type_matches += 1
        else:
            type_mismatches += 1
            if type_mismatches <= 10:
                print(f"\n  TYPE MISMATCH [{entry['uid']}] {entry['name']} mod prop={gm['property']}: "
                      f"displayType={gm['displayType']} vs maxroll={mx_type}")

print(f"\n\nDisplay type validation: {type_matches} matches, {type_mismatches} mismatches")
