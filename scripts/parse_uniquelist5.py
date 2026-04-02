"""Complete UniqueList parser with corrected structure:
  - name (string), displayName (string)
  - header (152 bytes): uid at +4, level at +56
  - modCount (int) + mods (modCount * 40 bytes)
  - descCount (int) + descCount * (string + string + int)
  - lore (string)
  - footerArrayCount (int) + footerArrayCount * int + 2 trailing ints
"""
import struct
import json
import sys

with open(r'c:\eob\scripts\uniquelist.bin', 'rb') as f:
    raw = f.read()

with open(r'c:\eob\packages\game-data\src\data\uniques-import.json', 'r') as f:
    maxroll_data = json.load(f)
maxroll_by_id = {item['uniqueID']: item for item in maxroll_data}

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
    start = pos
    
    # 1. Name
    name, pos = read_string(raw, pos)
    if name is None:
        return None, start, "name"
    
    # 2. Display name
    display_name, pos = read_string(raw, pos)
    if display_name is None:
        return None, start, "displayName"
    
    # 3. Header (152 bytes)
    if pos + 152 > len(raw):
        return None, start, "header overflow"
    uid = struct.unpack_from('<i', raw, pos + 4)[0]
    lvl = struct.unpack_from('<i', raw, pos + 56)[0]
    pos += 152
    
    # 4. Mod count + mods
    mod_count = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if mod_count < 0 or mod_count > 30:
        return None, start, f"bad mod_count={mod_count}"
    
    mods = []
    for m in range(mod_count):
        if pos + 40 > len(raw):
            return None, start, f"mod overflow at mod {m}"
        fields = struct.unpack_from('<fiifiiiiii', raw, pos)
        mods.append({
            'value': round(fields[0], 6),
            'canRoll': bool(fields[1]),
            'modCategory': fields[2],
            'maxValue': round(fields[3], 6),
            'property': fields[4],
            'specialTag': fields[5],
            'tags': fields[6],
            'unknown_a': fields[7],
            'type': fields[8],  # displayType: 0=flat, 1=increased%, 2=more%
            'unknown_c': fields[9],
        })
        pos += 40
    
    # 5. Descriptions: count + count * (string + string + int)
    desc_count = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if desc_count < 0 or desc_count > 50:
        return None, start, f"bad desc_count={desc_count}"
    
    descriptions = []
    for i in range(desc_count):
        s1, pos = read_string(raw, pos)
        if s1 is None:
            return None, start, f"desc[{i}].s1 failed"
        s2, pos = read_string(raw, pos)
        if s2 is None:
            return None, start, f"desc[{i}].s2 failed"
        trailing = struct.unpack_from('<i', raw, pos)[0]
        pos += 4
        descriptions.append({'primary': s1, 'secondary': s2, 'trailing': trailing})
    
    # 6. Lore
    lore, pos = read_string(raw, pos)
    if lore is None:
        return None, start, "lore failed"
    
    # 7. Footer: count + count*int + 2 trailing ints
    footer_count = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if footer_count < 0 or footer_count > 50:
        return None, start, f"bad footer_count={footer_count}"
    
    if pos + (footer_count + 2) * 4 > len(raw):
        return None, start, "footer overflow"
    
    footer_array = [struct.unpack_from('<i', raw, pos + i*4)[0] for i in range(footer_count)]
    pos += footer_count * 4
    footer_trailing = (struct.unpack_from('<i', raw, pos)[0], struct.unpack_from('<i', raw, pos+4)[0])
    pos += 8
    
    return {
        'name': name,
        'displayName': display_name,
        'uniqueID': uid,
        'levelRequirement': lvl,
        'mods': mods,
        'descriptions': descriptions,
        'lore': lore,
        'footerArray': footer_array,
        'footerTrailing': footer_trailing,
    }, pos, None


# Parse ALL entries
pos = 48
entries = []
for i in range(471):
    entry, next_pos, err = parse_entry(raw, pos)
    if entry is None:
        print(f"FAILED at entry {i}, pos {pos}: {err}")
        # Dump context
        for j in range(10):
            p = pos + j * 4
            if p + 4 <= len(raw):
                val = struct.unpack_from('<i', raw, p)[0]
                s, _ = read_string(raw, p)
                extra = f" STR='{s[:40]}'" if s and s.isprintable() and len(s) > 2 else ""
                print(f"  [{j}] pos {p}: int={val}{extra}")
        break
    entries.append(entry)
    pos = next_pos

print(f"Successfully parsed {len(entries)} / 471 entries\n")

# Validate displayType against maxroll
type_ok = 0
type_bad = 0
prop_ok = 0
prop_bad = 0
val_ok = 0
val_bad = 0
for entry in entries:
    mx = maxroll_by_id.get(entry['uniqueID'])
    if not mx:
        continue
    mx_mods = mx.get('mods', [])
    for gm, mm in zip(entry['mods'], mx_mods):
        if gm['type'] == mm.get('type', 0):
            type_ok += 1
        else:
            type_bad += 1
        if gm['property'] == mm.get('property', -1):
            prop_ok += 1
        else:
            prop_bad += 1
        if abs(gm['value'] - mm.get('value', 0)) < 0.01:
            val_ok += 1
        else:
            val_bad += 1

print(f"Validation across {len(entries)} entries:")
print(f"  displayType: {type_ok} match, {type_bad} mismatch")
print(f"  property:    {prop_ok} match, {prop_bad} mismatch")
print(f"  value:       {val_ok} match, {val_bad} mismatch")

# Show first 15 entries
for entry in entries[:15]:
    uid = entry['uniqueID']
    print(f"\n[{uid}] {entry['name']}" +
          (f" / {entry['displayName']}" if entry['displayName'] != entry['name'] else ""))
    print(f"  Level: {entry['levelRequirement']}, Mods: {len(entry['mods'])}")
    for i, mod in enumerate(entry['mods']):
        print(f"  Mod {i}: prop={mod['property']} val={mod['value']:.4f}-{mod['maxValue']:.4f} "
              f"type={mod['type']} tags={mod['tags']} special={mod['specialTag']}")
    print(f"  Descriptions ({len(entry['descriptions'])}):")
    for d in entry['descriptions']:
        s2_info = f" | s2='{d['secondary'][:40]}'" if d['secondary'] else ""
        t_info = f" t={d['trailing']}" if d['trailing'] else ""
        print(f"    '{d['primary'][:65]}'{s2_info}{t_info}")
    print(f"  Lore: '{entry['lore'][:65]}'")
    print(f"  Footer: [{len(entry['footerArray'])}] {entry['footerArray']} + {entry['footerTrailing']}")
