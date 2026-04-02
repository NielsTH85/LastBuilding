"""Parse AffixList binary by finding entry boundaries and extracting key fields.
Uses the known structure: pre-name strings, name, type, id, metadata, tiers, post-tier.
"""
import struct
import json

with open(r'c:\eob\scripts\affixlist.bin', 'rb') as f:
    raw = f.read()

with open(r'c:\eob\packages\game-data\src\data\equipment-import.json') as f:
    eq_data = json.load(f)
mx_affixes = {a['affixId']: a for a in eq_data['affixes']}

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

entry_count = struct.unpack_from('<i', raw, 52)[0]
print(f"Entry count: {entry_count}")

def try_parse_affix(raw, pos):
    """Try to parse a complete affix entry. Returns (entry, next_pos) or (None, pos_after_failed)."""
    start = pos
    
    # 1. Description string (tooltip text)
    desc, pos = read_string(raw, pos)
    if desc is None:
        return None, start
    
    # 2. Category string (may be empty)
    cat, pos = read_string(raw, pos)
    if cat is None:
        return None, start
    
    # 3. Long description string (may be empty)
    long_desc, pos = read_string(raw, pos)
    if long_desc is None:
        return None, start
    
    # 4. Unknown int
    unk1 = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    
    # 5. Affix name/title
    title, pos = read_string(raw, pos)
    if title is None:
        return None, start
    
    # 6. Affix type (0/2=prefix, 3=suffix)
    affix_type = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    
    # 7. Affix ID
    affix_id = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    
    # 8. Level requirement
    level_req = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    
    if affix_id < 0 or affix_id > 1000:
        return None, start
    if level_req < 0 or level_req > 100:
        return None, start
    
    # 9-10. Skip metadata - read remaining fixed fields before tier count
    # From entry 0: after level_req at pos 112, there are fields at:
    #   +0 to +68: metadata (17 ints/floats before tier count at +68)
    # Actually, let me find the tier count by scanning for a reasonable value
    # followed by (min_float, max_float, int) triples
    
    # Skip metadata block - based on entry 0, there are many ints between
    # level_req and tier_count. Let me read everything as a block.
    metadata_start = pos
    
    # Search for tier count in the next ~80 bytes
    best_tier_pos = None
    for offset in range(0, 120, 4):
        test_pos = metadata_start + offset
        if test_pos + 16 > len(raw):
            break
        tc = struct.unpack_from('<i', raw, test_pos)[0]
        if tc < 1 or tc > 12:
            continue
        # Check if next data looks like tier values (min, max, int triples)
        looks_ok = True
        for t in range(min(tc, 3)):
            tp = test_pos + 4 + t * 12
            if tp + 12 > len(raw):
                looks_ok = False
                break
            t_min = struct.unpack_from('<f', raw, tp)[0]
            t_max = struct.unpack_from('<f', raw, tp + 4)[0]
            # Values should be reasonable (0 to 10000)
            if not (-1000 < t_min < 10000) or not (-1000 < t_max < 10000):
                looks_ok = False
                break
            # min should generally be <= max (or close)
            if t_min > t_max * 2 + 10:
                looks_ok = False
                break
        if looks_ok:
            best_tier_pos = test_pos
            break
    
    if best_tier_pos is None:
        return None, start
    
    metadata_size = best_tier_pos - metadata_start
    pos = best_tier_pos
    
    # 11. Tier count
    tier_count = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    
    # 12. Tiers (min, max, extra per tier)
    tiers = []
    for t in range(tier_count):
        if pos + 12 > len(raw):
            return None, start
        t_min = struct.unpack_from('<f', raw, pos)[0]
        t_max = struct.unpack_from('<f', raw, pos + 4)[0]
        t_extra = struct.unpack_from('<i', raw, pos + 8)[0]
        tiers.append({'tier': t + 1, 'minValue': round(t_min, 6), 'maxValue': round(t_max, 6), 'extra': t_extra})
        pos += 12
    
    # 13. Post-tier data - need to find where next entry starts
    # For now, just record the position after tiers
    
    return {
        'desc': desc,
        'category': cat,
        'longDesc': long_desc,
        'title': title,
        'affixType': affix_type,
        'affixId': affix_id,
        'levelRequirement': level_req,
        'metadata_size': metadata_size,
        'tier_count': tier_count,
        'tiers': tiers,
        'tier_end_pos': pos,
    }, pos

# Parse first 30 entries
pos = 56
entries = []
for i in range(30):
    entry, next_pos = try_parse_affix(raw, pos)
    if entry is None:
        print(f"Failed at entry {i}, pos {pos}")
        # Dump context
        for j in range(10):
            p = pos + j * 4
            if p + 4 <= len(raw):
                val = struct.unpack_from('<i', raw, p)[0]
                s, _ = read_string(raw, p)
                extra = f" STR='{s[:40]}'" if s and s.isprintable() and len(s) > 2 else ""
                print(f"  pos {p}: {val}{extra}")
        break
    
    # Now find where the next entry starts by looking for a string after post-tier data
    found_next = False
    scan_pos = entry['tier_end_pos']
    for offset in range(0, 200, 4):
        test_pos = scan_pos + offset
        s, _ = read_string(raw, test_pos)
        if s and len(s) >= 3 and s.isprintable():
            # Check if this could be a description string for next entry
            # The next position after this string should lead to more valid data
            pos = test_pos
            found_next = True
            break
    
    if not found_next:
        print(f"Couldn't find next entry after {i}")
        break
    
    entries.append(entry)
    
    # Cross-reference with maxroll
    mx = mx_affixes.get(entry['affixId'])
    mx_info = ""
    if mx:
        mx_tier1 = mx['tiers'][0] if mx['tiers'] else {}
        tier_match = len(entry['tiers']) >= 1 and mx_tier1 and \
            abs(entry['tiers'][0]['minValue'] - mx_tier1.get('minValue', -999)) < 0.01
        mx_info = f" mx_name='{mx['name']}' mx_title='{mx['title']}' tier_match={'Y' if tier_match else 'N'}"
    
    print(f"[{entry['affixId']:3d}] {entry['title']:<20s} type={entry['affixType']} lvl={entry['levelRequirement']:2d} "
          f"desc='{entry['desc'][:35]}' tiers={entry['tier_count']} meta={entry['metadata_size']}B{mx_info}")
