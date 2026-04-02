"""Check if unknown_c maps to hideInTooltip, then export full JSON."""
import struct
import json

with open(r'c:\eob\scripts\uniquelist.bin', 'rb') as f:
    raw = f.read()

with open(r'c:\eob\packages\game-data\src\data\uniques-import.json', 'r') as f:
    maxroll_data = json.load(f)
maxroll_by_id = {item['uniqueID']: item for item in maxroll_data}

HEADER_SIZE = 148

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
    name, pos = read_string(raw, pos)
    if name is None: return None, start
    dn, pos = read_string(raw, pos)
    if dn is None: return None, start
    vn, pos = read_string(raw, pos)
    if vn is None: return None, start

    if pos + HEADER_SIZE > len(raw): return None, start
    header = [struct.unpack_from('<i', raw, pos + i*4)[0] for i in range(HEADER_SIZE // 4)]
    uid = header[0]
    lvl = header[13]
    legend_type = header[14]
    base_type = header[34]
    pos += HEADER_SIZE

    mc = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if mc < 0 or mc > 30: return None, start

    mods = []
    for m in range(mc):
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
            'type': fields[8],
            'unknown_c': fields[9],
        })
        pos += 40

    dc = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    descs = []
    for i in range(dc):
        s1, pos = read_string(raw, pos)
        s2, pos = read_string(raw, pos)
        trailing = struct.unpack_from('<i', raw, pos)[0]
        pos += 4
        descs.append({'primary': s1 or '', 'secondary': s2 or '', 'trailing': trailing})

    lore, pos = read_string(raw, pos)

    fc = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    fa = [struct.unpack_from('<i', raw, pos + i*4)[0] for i in range(fc)]
    pos += fc * 4
    ft = (struct.unpack_from('<i', raw, pos)[0], struct.unpack_from('<i', raw, pos+4)[0])
    pos += 8

    return {
        'name': name, 'displayName': dn, 'variantName': vn,
        'uniqueID': uid, 'levelRequirement': lvl,
        'legendaryType': legend_type, 'baseType': base_type,
        'header': header, 'mods': mods, 'descriptions': descs,
        'lore': lore or '', 'footerArray': fa, 'footerTrailing': ft,
    }, pos

# Parse all
pos = 48
entries = []
for i in range(471):
    entry, next_pos = parse_entry(raw, pos)
    if entry is None:
        break
    entries.append(entry)
    pos = next_pos
print(f"Parsed {len(entries)} entries")

# Check unknown_c vs hideInTooltip
c_ok = c_bad = 0
for entry in entries:
    mx = maxroll_by_id.get(entry['uniqueID'])
    if not mx: continue
    mx_mods = mx.get('mods', [])
    for gm, mm in zip(entry['mods'], mx_mods):
        mx_hide = mm.get('hideInTooltip', False)
        game_c = bool(gm['unknown_c'])
        if game_c == mx_hide:
            c_ok += 1
        else:
            c_bad += 1
            if c_bad <= 5:
                print(f"  MISMATCH [{entry['uniqueID']}] {entry['name']} mod prop={gm['property']}: "
                      f"c={gm['unknown_c']} vs hide={mx_hide}")

print(f"\nunknown_c vs hideInTooltip: {c_ok} match, {c_bad} mismatch")

# Check unknown_a vs hideInTooltip
a_ok = a_bad = 0
for entry in entries:
    mx = maxroll_by_id.get(entry['uniqueID'])
    if not mx: continue
    mx_mods = mx.get('mods', [])
    for gm, mm in zip(entry['mods'], mx_mods):
        mx_hide = mm.get('hideInTooltip', False)
        game_a = bool(gm['unknown_a'])
        if game_a == mx_hide:
            a_ok += 1
        else:
            a_bad += 1

print(f"unknown_a vs hideInTooltip: {a_ok} match, {a_bad} mismatch")

# Check canRoll vs hideInTooltip (negative correlation?)
cr_ok = cr_bad = 0
for entry in entries:
    mx = maxroll_by_id.get(entry['uniqueID'])
    if not mx: continue
    mx_mods = mx.get('mods', [])
    for gm, mm in zip(entry['mods'], mx_mods):
        mx_hide = mm.get('hideInTooltip', False)
        game_nocr = not gm['canRoll']
        if game_nocr == mx_hide:
            cr_ok += 1
        else:
            cr_bad += 1

print(f"!canRoll vs hideInTooltip: {cr_ok} match, {cr_bad} mismatch")

# Check modCategory for patterns
print(f"\nmodCategory distribution:")
cats = {}
for entry in entries:
    for mod in entry['mods']:
        c = mod['modCategory']
        cats[c] = cats.get(c, 0) + 1
for c, n in sorted(cats.items()):
    print(f"  cat={c}: {n} mods")

# Export to uniques-gamedata.json
output = []
for entry in entries:
    item = {
        'uniqueID': entry['uniqueID'],
        'name': entry['displayName'] if entry['displayName'] else entry['name'],
        'internalName': entry['name'],
        'baseType': entry['baseType'],
        'subTypes': entry['footerArray'],
        'mods': [],
        'legendaryType': entry['legendaryType'],
        'levelRequirement': entry['levelRequirement'],
        'loreText': entry['lore'],
    }
    if entry['displayName'] and entry['displayName'] != entry['name']:
        item['displayName'] = entry['displayName']
    if entry['variantName']:
        item['variantName'] = entry['variantName']
    
    for mod in entry['mods']:
        m = {
            'property': mod['property'],
            'value': mod['value'],
            'canRoll': mod['canRoll'],
            'maxValue': mod['maxValue'],
            'tags': mod['tags'],
        }
        if mod['specialTag']:
            m['specialTag'] = mod['specialTag']
        if mod['type']:
            m['type'] = mod['type']
        if mod['unknown_c']:
            m['hideInTooltip'] = True
        output.append  # placeholder
        item['mods'].append(m)
    
    if entry['descriptions']:
        item['tooltipDescriptions'] = [
            d['primary'] for d in entry['descriptions'] if d['primary']
        ]
    
    output.append(item)

with open(r'c:\eob\packages\game-data\src\data\uniques-gamedata.json', 'w') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"\nExported {len(output)} uniques to uniques-gamedata.json")
print(f"Sample: {json.dumps(output[0], indent=2)}")
