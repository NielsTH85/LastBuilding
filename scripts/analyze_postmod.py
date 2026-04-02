"""Analyze post-mod binary structure in UniqueList to decode descriptions, lore, and footer."""
import struct
import json

with open(r'c:\eob\scripts\uniquelist.bin', 'rb') as f:
    raw = f.read()

with open(r'c:\eob\packages\game-data\src\data\uniques-import.json', 'r') as f:
    maxroll_data = json.load(f)
maxroll_names = {item['name'] for item in maxroll_data}

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

def parse_entry_start(raw, pos):
    """Parse name, displayName, header, modCount, mods. Returns (entry_info, pos_after_mods)."""
    name, pos = read_string(raw, pos)
    if name is None:
        return None, pos
    display_name, pos = read_string(raw, pos)
    if display_name is None:
        return None, pos
    
    uid = struct.unpack_from('<i', raw, pos + 4)[0]
    lvl = struct.unpack_from('<i', raw, pos + 56)[0]
    pos += 152
    
    mod_count = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    
    if mod_count < 0 or mod_count > 30:
        return None, pos
    
    mods = []
    for m in range(mod_count):
        fields = struct.unpack_from('<fiifiiiiii', raw, pos)
        mods.append(fields)
        pos += 40
    
    return {'name': name, 'displayName': display_name, 'uid': uid, 'level': lvl, 
            'mod_count': mod_count, 'mods': mods}, pos


# Parse first 5 entries, analyzing post-mod data precisely
pos = 48
for entry_idx in range(5):
    entry, mod_end = parse_entry_start(raw, pos)
    if not entry:
        print(f"Failed at entry {entry_idx}")
        break
    
    print(f"\n{'='*80}")
    print(f"Entry {entry_idx}: {entry['name']} (uid={entry['uid']}, level={entry['level']})")
    print(f"  Mods: {entry['mod_count']}, mod data ends at pos {mod_end}")
    
    # Now decode post-mod data step by step
    p = mod_end
    
    # Try: first int = description count
    desc_count = struct.unpack_from('<i', raw, p)[0]
    print(f"\n  Post-mod pos {p}: int = {desc_count} (possibly description count)")
    p += 4
    
    # Try reading desc_count strings
    descs = []
    for i in range(desc_count):
        s, p = read_string(raw, p)
        if s is not None:
            descs.append(s)
            print(f"  Description {i}: '{s[:80]}' (next pos: {p})")
        else:
            print(f"  Description {i}: FAILED to read string at {p}")
            break
    
    # Try reading lore string
    lore, p = read_string(raw, p)
    if lore is not None:
        print(f"  Lore: '{lore[:80]}' (next pos: {p})")
    else:
        print(f"  Lore: FAILED at pos {p}")
    
    # Dump remaining values until we can try to read the next entry
    print(f"\n  Remaining data from pos {p}:")
    footer_start = p
    for i in range(30):
        if p + 4 > len(raw):
            break
        val = struct.unpack_from('<i', raw, p)[0]
        fval = struct.unpack_from('<f', raw, p)[0]
        
        # Check if this could be a string
        if 1 <= val <= 500:
            s, np = read_string(raw, p)
            if s is not None and len(s) > 1 and s.isprintable():
                print(f"    pos {p} (+{p - footer_start}): STRING '{s[:60]}' (len={val})")
                # Don't advance - just show it
        
        print(f"    pos {p} (+{p - footer_start}): int={val:10d}  float={fval:12.6f}  hex={val:#010x}")
        p += 4
    
    # Now try to find the next entry by attempting to parse from various positions
    print(f"\n  Searching for next entry start:")
    for offset in range(0, 80, 4):
        test_pos = footer_start + offset
        result, _ = parse_entry_start(raw, test_pos)
        if result and result['mod_count'] >= 1 and result['mod_count'] <= 20:
            # Verify it's a real entry by checking if name is reasonable
            if result['name'] and len(result['name']) > 2 and result['name'][0].isupper():
                print(f"    FOUND at footer+{offset} (pos {test_pos}): {result['name']} uid={result['uid']} mods={result['mod_count']}")
                pos = test_pos
                break
    else:
        print("    Could not find next entry!")
        break
