"""Check all entries in the UniqueList binary to find parse issues."""
import struct

with open(r'c:\eob\scripts\uniquelist.bin', 'rb') as f:
    raw = f.read()

def read_string(raw, pos):
    if pos + 4 > len(raw):
        return None, pos
    strlen = struct.unpack_from('<i', raw, pos)[0]
    if strlen < 0 or strlen > 50000 or pos + 4 + strlen > len(raw):
        return None, pos
    s = raw[pos+4:pos+4+strlen].decode('utf-8', errors='replace')
    next_pos = pos + 4 + strlen
    next_pos = (next_pos + 3) & ~3
    return s, next_pos

HEADER_SIZE = 148

def parse_entry(raw, pos):
    start = pos
    name, pos = read_string(raw, pos)
    if name is None: return None, start, 'name'
    dn, pos = read_string(raw, pos)
    if dn is None: return None, start, 'dn'
    vn, pos = read_string(raw, pos)
    if vn is None: return None, start, 'vn'
    if pos + HEADER_SIZE > len(raw): return None, start, 'header'
    header = [struct.unpack_from('<i', raw, pos + i*4)[0] for i in range(37)]
    uid = header[0]
    lvl = header[13]
    legend_type = header[14]
    base_type = header[34]
    pos += HEADER_SIZE

    mc = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if mc < 0 or mc > 30: return None, start, f'bad_mc={mc}'

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
            'hideInTooltip': bool(fields[9]),
        })
        pos += 40

    dc = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if dc < 0 or dc > 50: return None, start, f'bad_dc={dc}'
    descs = []
    for i in range(dc):
        s1, pos = read_string(raw, pos)
        s2, pos = read_string(raw, pos)
        if s1 is None or s2 is None: return None, start, f'desc_string_fail_{i}'
        trailing = struct.unpack_from('<i', raw, pos)[0]
        pos += 4
        if s1: descs.append(s1)

    lore, pos = read_string(raw, pos)
    if lore is None: return None, start, 'lore'

    fc = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if fc < 0 or fc > 100: return None, start, f'bad_fc={fc}'
    fa = [struct.unpack_from('<i', raw, pos + i*4)[0] for i in range(fc)]
    pos += fc * 4
    if pos + 8 > len(raw): return None, start, 'footer_trailing'
    pos += 8

    return {
        'uid': uid, 'name': name, 'dn': dn, 'vn': vn,
        'mods': mods, 'descs': descs,
        'baseType': base_type, 'legendaryType': legend_type, 'lvl': lvl,
        'lore': lore, 'footerArray': fa,
    }, pos, None

total = struct.unpack_from('<i', raw, 44)[0]
print(f'Total entries in binary: {total}, file size: {len(raw)} bytes')

pos = 48
entries = []
for i in range(total):
    entry, next_pos, err = parse_entry(raw, pos)
    if entry is None:
        print(f'FAIL at entry {i}, pos {pos}: {err}')
        break
    entries.append(entry)
    pos = next_pos

print(f'Parsed {len(entries)} / {total} entries')
print(f'Final pos: {pos}, remaining bytes: {len(raw) - pos}')

# Show last 5 entries
print('\n--- Last 5 entries ---')
for e in entries[-5:]:
    print(f"  uid={e['uid']} name={e['name']} mods={len(e['mods'])} descs={len(e['descs'])} base={e['baseType']}")
    for m in e['mods']:
        print(f"    prop={m['property']} val={m['value']} maxVal={m['maxValue']} type={m['type']} tags={m['tags']}")

# Summary stats
total_mods = sum(len(e['mods']) for e in entries)
total_descs = sum(len(e['descs']) for e in entries)
zero_mod = [e for e in entries if len(e['mods']) == 0]
print(f'\nTotal mods: {total_mods}')
print(f'Total description strings: {total_descs}')
print(f'Entries with 0 mods: {len(zero_mod)}')
for e in zero_mod:
    print(f"  uid={e['uid']} name={e['name']}")
