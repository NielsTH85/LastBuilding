"""Find the exact footer structure by searching for entry boundaries."""
import struct
import json

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

def try_parse_entry_start(raw, pos):
    """Try to parse name/displayName/header/mods at pos. Returns entry or None."""
    start = pos
    name, pos = read_string(raw, pos)
    if name is None or len(name) < 2 or len(name) > 60:
        return None
    # Name should look like a proper name (starts with uppercase, mostly alpha)
    if not name[0].isupper():
        return None
    
    display_name, pos = read_string(raw, pos)
    if display_name is None:
        return None
    
    if pos + 156 > len(raw):
        return None
    
    uid = struct.unpack_from('<i', raw, pos + 4)[0]
    lvl = struct.unpack_from('<i', raw, pos + 56)[0]
    
    if uid < 0 or uid > 1000:
        return None
    if lvl < 0 or lvl > 100:
        return None
    
    pos += 152
    mod_count = struct.unpack_from('<i', raw, pos)[0]
    if mod_count < 0 or mod_count > 20:
        return None
    
    return {'name': name, 'displayName': display_name, 'uid': uid, 'level': lvl, 'mod_count': mod_count}

def parse_up_to_lore(raw, pos):
    """Parse entry up to end of lore. Returns (entry_data, pos_after_lore) or (None, pos)."""
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
    if mod_count < 0 or mod_count > 30:
        return None, start
    
    mods = []
    for m in range(mod_count):
        fields = struct.unpack_from('<fiifiiiiii', raw, pos)
        mods.append(fields)
        pos += 40
    
    # desc_count
    desc_count = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if desc_count < 0 or desc_count > 50:
        return None, start
    
    # descriptions (string + 2 ints each)
    descriptions = []
    for i in range(desc_count):
        s, pos = read_string(raw, pos)
        if s is None:
            return None, start
        f1 = struct.unpack_from('<i', raw, pos)[0]
        f2 = struct.unpack_from('<i', raw, pos + 4)[0]
        pos += 8
        descriptions.append((s, f1, f2))
    
    # lore
    lore, pos = read_string(raw, pos)
    if lore is None:
        return None, start
    
    return {
        'name': name, 'displayName': display_name, 'uid': uid, 'level': lvl,
        'mod_count': mod_count, 'mods': mods, 'desc_count': desc_count,
        'descriptions': descriptions, 'lore': lore,
    }, pos

# Parse first 20 entries, finding footer size by searching for next entry
pos = 48
for entry_idx in range(20):
    entry, lore_end = parse_up_to_lore(raw, pos)
    if entry is None:
        print(f"Failed to parse entry {entry_idx} at pos {pos}")
        break
    
    print(f"\n[{entry['uid']}] {entry['name']}: mods={entry['mod_count']}, descs={entry['desc_count']}")
    print(f"  Lore: '{entry['lore'][:60]}'")
    print(f"  Lore ends at pos {lore_end}")
    
    # Search for next entry start
    found = False
    for footer_size in range(0, 60):
        test_pos = lore_end + footer_size * 4
        result = try_parse_entry_start(raw, test_pos)
        if result and result['uid'] >= 0 and result['mod_count'] >= 1:
            footer_ints = [struct.unpack_from('<i', raw, lore_end + i*4)[0] for i in range(footer_size)]
            print(f"  Footer: {footer_size} ints = {footer_ints}")
            print(f"  Next: [{result['uid']}] {result['name']} (mods={result['mod_count']})")
            pos = test_pos
            found = True
            break
    
    if not found:
        print(f"  Could not find next entry after lore_end={lore_end}")
        # Dump some data
        for i in range(20):
            p = lore_end + i * 4
            if p + 4 <= len(raw):
                val = struct.unpack_from('<i', raw, p)[0]
                s, _ = read_string(raw, p)
                extra = f" STR='{s[:40]}'" if s and s.isprintable() and len(s) > 2 else ""
                print(f"    pos {p} (+{i*4}): {val}{extra}")
        break
