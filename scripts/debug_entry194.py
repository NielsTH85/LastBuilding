"""Debug entry 194/195 border - detailed analysis."""
import struct

with open(r'c:\eob\scripts\uniquelist.bin', 'rb') as f:
    raw = f.read()

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

def full_parse_to_lore(raw, pos):
    name, pos = read_string(raw, pos)
    if name is None: return None, 0, 0
    dn, pos = read_string(raw, pos)
    if dn is None: return None, 0, 0
    uid = struct.unpack_from('<i', raw, pos + 4)[0]
    pos += 152
    mc = struct.unpack_from('<i', raw, pos)[0]
    pos += 4 + mc * 40
    dc = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    for i in range(dc):
        _, pos = read_string(raw, pos)
        _, pos = read_string(raw, pos)
        pos += 4
    lore, pos = read_string(raw, pos)
    return name, uid, pos

def full_parse_entry(raw, pos):
    name, pos = read_string(raw, pos)
    if name is None: return None, pos
    dn, pos = read_string(raw, pos)
    if dn is None: return None, pos
    uid = struct.unpack_from('<i', raw, pos + 4)[0]
    pos += 152
    mc = struct.unpack_from('<i', raw, pos)[0]
    pos += 4 + mc * 40
    dc = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    for i in range(dc):
        _, pos = read_string(raw, pos)
        _, pos = read_string(raw, pos)
        pos += 4
    _, pos = read_string(raw, pos)
    fc = struct.unpack_from('<i', raw, pos)[0]
    pos += 4 + fc * 4 + 8
    return {'name': name, 'uid': uid, 'mc': mc, 'dc': dc, 'fc': fc}, pos

# Skip to entry 193
pos = 48
for i in range(193):
    _, pos = full_parse_entry(raw, pos)

# Parse entries 193, 194, 195 with full detail
for idx in [193, 194, 195, 196]:
    print(f"\n{'='*60}")
    name, uid, lore_end = full_parse_to_lore(raw, pos)
    print(f"Entry {idx}: {name} uid={uid} lore_end={lore_end}")
    
    # Dump 40 ints from lore_end
    print(f"Data from lore_end ({lore_end}):")
    for i in range(40):
        p = lore_end + i * 4
        if p + 4 > len(raw): break
        val = struct.unpack_from('<i', raw, p)[0]
        fval = struct.unpack_from('<f', raw, p)[0]
        s, _ = read_string(raw, p)
        extra = ""
        if s and len(s) > 2 and s.isprintable():
            extra = f"  STR='{s[:50]}'"
        print(f"  [{i:2d}] pos {p}: int={val:12d}  float={fval:12.6f}{extra}")
    
    # Also parse with footer formula and advance
    entry, next_pos = full_parse_entry(raw, pos)
    if entry:
        print(f"\nParsed: {entry['name']} uid={entry['uid']} mc={entry['mc']} dc={entry['dc']} fc={entry['fc']}")
        print(f"Next pos: {next_pos}")
        pos = next_pos
    else:
        print("FAILED to parse this entry!")
        break
