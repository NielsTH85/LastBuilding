"""Debug entry 196 failure - check if footer trailing has different size."""
import struct
import json

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

def try_parse_entry_start(raw, pos):
    start = pos
    name, pos = read_string(raw, pos)
    if name is None or len(name) < 2 or len(name) > 80:
        return None
    if not name[0].isupper() and not name[0].isdigit():
        return None
    display_name, pos = read_string(raw, pos)
    if display_name is None:
        return None
    if pos + 156 > len(raw):
        return None
    uid = struct.unpack_from('<i', raw, pos + 4)[0]
    lvl = struct.unpack_from('<i', raw, pos + 56)[0]
    if uid < 0 or uid > 1000 or lvl < 0 or lvl > 100:
        return None
    pos += 152
    mod_count = struct.unpack_from('<i', raw, pos)[0]
    if mod_count < 0 or mod_count > 20:
        return None
    return {'name': name, 'displayName': display_name, 'uid': uid, 'level': lvl, 'mod_count': mod_count}

def parse_up_to_lore(raw, pos):
    start = pos
    name, pos = read_string(raw, pos)
    if name is None:
        return None, start
    display_name, pos = read_string(raw, pos)
    if display_name is None:
        return None, start
    uid = struct.unpack_from('<i', raw, pos + 4)[0]
    lvl = struct.unpack_from('<i', raw, pos + 56)[0]
    pos += 152
    mod_count = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    for m in range(mod_count):
        pos += 40
    desc_count = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    descs = []
    for i in range(desc_count):
        s1, pos = read_string(raw, pos)
        s2, pos = read_string(raw, pos)
        trailing = struct.unpack_from('<i', raw, pos)[0]
        pos += 4
        descs.append((s1, s2, trailing))
    lore, pos = read_string(raw, pos)
    return {'name': name, 'uid': uid, 'level': lvl, 'mods': mod_count, 'descs': descs, 'lore': lore}, pos

# Parse entries 190-200 using the known-good parser, recording footer details
# First: use full parse to get to entry 190
def full_parse_entry(raw, pos):
    start = pos
    name, pos = read_string(raw, pos)
    if name is None: return None, start
    dn, pos = read_string(raw, pos)
    if dn is None: return None, start
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
    return {'name': name, 'uid': uid}, pos

pos = 48
for i in range(196):
    entry, pos = full_parse_entry(raw, pos)
    if entry is None:
        print(f"Failed at entry {i}")
        break
    if i >= 190:
        print(f"Entry {i}: uid={entry['uid']} name={entry['name']} -> next_pos={pos}")

# Now we're at entry 195's footer end position (which is where 196 should start)
print(f"\nExpected entry 196 start: pos {pos}")

# Go back and re-parse entries 194 and 195 with detailed footer analysis
# Parse from a known good position
pos2 = 48
for i in range(194):
    _, pos2 = full_parse_entry(raw, pos2)

print(f"\n--- Entry 194 ---")
entry194, lore_end194 = parse_up_to_lore(raw, pos2)
print(f"Name: {entry194['name']}, uid={entry194['uid']}")
print(f"Lore ends at: {lore_end194}")

# Search for next entry
print("Searching for entry 195:")
for footer_size in range(0, 40):
    test_pos = lore_end194 + footer_size * 4
    result = try_parse_entry_start(raw, test_pos)
    if result and result['mod_count'] >= 1:
        footer_ints = [struct.unpack_from('<i', raw, lore_end194 + i*4)[0] for i in range(footer_size)]
        print(f"  Footer {footer_size} ints: {footer_ints}")
        print(f"  Next: [{result['uid']}] {result['name']} mods={result['mod_count']}")
        pos3 = test_pos
        break

print(f"\n--- Entry 195 ---")
entry195, lore_end195 = parse_up_to_lore(raw, pos3)
print(f"Name: {entry195['name']}, uid={entry195['uid']}")
print(f"Descs: {[(d[0][:40], d[1][:20] if d[1] else '', d[2]) for d in entry195['descs']]}")
print(f"Lore: '{entry195['lore'][:60]}'")
print(f"Lore ends at: {lore_end195}")

# Search for entry 196
print("Searching for entry 196:")
for footer_size in range(0, 40):
    test_pos = lore_end195 + footer_size * 4
    result = try_parse_entry_start(raw, test_pos)
    if result and result['mod_count'] >= 0:
        footer_ints = [struct.unpack_from('<i', raw, lore_end195 + i*4)[0] for i in range(footer_size)]
        print(f"  Footer {footer_size} ints: {footer_ints}")
        print(f"  Next: [{result['uid']}] {result['name']} mods={result['mod_count']}")
        break
else:
    print("  NOT FOUND in range 0-39!")
    # Dump raw data
    print(f"\n  Raw data from lore_end195 ({lore_end195}):")
    for i in range(30):
        p = lore_end195 + i * 4
        val = struct.unpack_from('<i', raw, p)[0]
        fval = struct.unpack_from('<f', raw, p)[0]
        s, _ = read_string(raw, p)
        extra = f"  STR='{s[:40]}'" if s and s.isprintable() and len(s) > 2 else ""
        print(f"    [{i:2d}] pos {p}: int={val:12d}  float={fval:12.6f}{extra}")
