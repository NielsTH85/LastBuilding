"""Find all affix entry boundaries by scanning for name positions.
Each affix name is followed by (type, id) where type is 0/2/3 and id is 0-577.
"""
import struct
import json

with open(r'c:\eob\scripts\affixlist.bin', 'rb') as f:
    raw = f.read()

with open(r'c:\eob\packages\game-data\src\data\equipment-import.json') as f:
    eq_data = json.load(f)
mx_affixes = {a['affixId']: a for a in eq_data['affixes']}
mx_by_title = {a['title']: a for a in eq_data['affixes']}

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

# Strategy: find all (name, type, id) triples in the binary
# An affix name string is followed by type(0/1/2/3) and id(0-577)
candidates = []
pos = 56
while pos < len(raw) - 20:
    s, npos = read_string(raw, pos)
    if s and 2 <= len(s) <= 40 and s.isprintable():
        atype = struct.unpack_from('<i', raw, npos)[0]
        aid = struct.unpack_from('<i', raw, npos + 4)[0]
        if atype in (0, 1, 2, 3) and 0 <= aid <= 600:
            # Additional validation: check if name looks like an affix name
            # Affix names: "of Defense", "Deft", "Guardian's", etc.
            if len(s) >= 2:
                candidates.append({
                    'pos': pos, 'name': s, 'type': atype, 'id': aid,
                    'name_end': npos, 'next_int3': struct.unpack_from('<i', raw, npos + 8)[0],
                })
    pos += 4

print(f"Found {len(candidates)} name candidates")

# Find the true affix names by checking that IDs cover the expected range
# and names match known maxroll titles or look like affix names
# Group by ID to find duplicates
id_groups = {}
for c in candidates:
    if c['id'] not in id_groups:
        id_groups[c['id']] = []
    id_groups[c['id']].append(c)

# For each ID, pick the candidate that matches maxroll title
true_names = {}
for aid, cands in sorted(id_groups.items()):
    # Check maxroll match
    mx = mx_affixes.get(aid)
    if mx:
        for c in cands:
            if c['name'] == mx['title']:
                true_names[aid] = c
                break
        if aid not in true_names and cands:
            # Pick first candidate
            true_names[aid] = cands[0]
    else:
        # No maxroll data - use first candidate if it looks reasonable
        for c in cands:
            if c['name'][0].isupper() or c['name'].startswith('of '):
                true_names[aid] = c
                break

# Sort by position
sorted_names = sorted(true_names.values(), key=lambda x: x['pos'])
print(f"Identified {len(sorted_names)} true affix names")
print(f"ID range: {min(x['id'] for x in sorted_names)} - {max(x['id'] for x in sorted_names)}")

# Show first 20
for n in sorted_names[:20]:
    mx = mx_affixes.get(n['id'])
    mx_match = mx['title'] == n['name'] if mx else '?'
    print(f"  [{n['id']:3d}] pos={n['pos']:6d} '{n['name']:<25s}' type={n['type']} lvl={n['next_int3']} mx_match={mx_match}")

# Calculate gaps between entries
print(f"\nGaps between affix names:")
for i in range(min(20, len(sorted_names)-1)):
    a1 = sorted_names[i]
    a2 = sorted_names[i+1]
    gap = a2['pos'] - a1['pos']
    print(f"  [{a1['id']:3d}] -> [{a2['id']:3d}]: {gap} bytes")

# Now find description strings BEFORE each name
print(f"\nEntry structure analysis (first 15):")
for i in range(min(15, len(sorted_names))):
    n = sorted_names[i]
    # Search backwards from name position for the entry start
    # The entry starts with a description string
    # Between entries, there's post-tier + post data
    if i > 0:
        prev_end = sorted_names[i-1]['name_end'] + 8  # skip type + id
    else:
        prev_end = 56  # file start
    
    # Find the first string between prev_end and this name
    entry_start = None
    scan = prev_end
    while scan < n['pos']:
        s, _ = read_string(raw, scan)
        if s and len(s) >= 3 and s.isprintable():
            entry_start = scan
            break
        scan += 4
    
    if entry_start:
        # Read the entry strings
        desc, p = read_string(raw, entry_start)
        cat, p = read_string(raw, p)
        long_desc, p = read_string(raw, p)
        pre_name_gap = n['pos'] - p
        print(f"  [{n['id']:3d}] start={entry_start} desc='{desc[:35]}' cat='{cat[:15]}' gap_to_name={pre_name_gap}B")
    else:
        print(f"  [{n['id']:3d}] start=? name at {n['pos']}")

# Find where tier data is for first 5 entries
print(f"\nTier data search (first 5):")
for i in range(min(5, len(sorted_names))):
    n = sorted_names[i]
    mx = mx_affixes.get(n['id'])
    if not mx or not mx['tiers']:
        continue
    
    mx_t1_min = mx['tiers'][0]['minValue']
    mx_t1_max = mx['tiers'][0]['maxValue']
    mx_tcount = len(mx['tiers'])
    
    # Search for tier data after the name
    search_start = n['name_end'] + 12  # skip type, id, level_req
    search_end = sorted_names[i+1]['pos'] if i+1 < len(sorted_names) else search_start + 500
    
    for offset in range(0, search_end - search_start, 4):
        test_pos = search_start + offset
        tc = struct.unpack_from('<i', raw, test_pos)[0]
        if tc == mx_tcount:
            # Check if next values match tier 1 min/max
            t1_min = struct.unpack_from('<f', raw, test_pos + 4)[0]
            t1_max = struct.unpack_from('<f', raw, test_pos + 8)[0]
            if abs(t1_min - mx_t1_min) < 0.01 and abs(t1_max - mx_t1_max) < 0.01:
                dist = test_pos - n['name_end'] - 8  # from after (type, id) pair
                print(f"  [{n['id']:3d}] tier_count={tc} at offset {test_pos} (name_end+{dist}B) "
                      f"T1: {t1_min:.4f}-{t1_max:.4f} {'MATCH' if abs(t1_min-mx_t1_min)<0.001 else 'close'}")
                break
