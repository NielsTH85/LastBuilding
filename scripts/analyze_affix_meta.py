"""Analyze metadata between level_req and tier_count for first 10 affix entries."""
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

# Known affix name positions (from previous analysis)
# Manually list first 15 entries
name_positions = [
    (88, 'Inevitable', 0), (376, 'of Defense', 1), (676, 'Deft', 2),
    (976, "Guardian's", 3), (1244, "Shade's", 4), (1548, "Assassin's", 5),
    (1924, 'Eviscerating', 6), (2272, 'of Hope', 7), (2764, 'of Evasion', 8),
    (3068, 'Shimmering', 9), (3356, 'of Purity', 10),
]

for name_pos, name, aid in name_positions:
    # Read name string to confirm position
    s, name_end = read_string(raw, name_pos)
    assert s == name, f"Name mismatch at {name_pos}: '{s}' vs '{name}'"
    
    # type, id, level_req
    atype = struct.unpack_from('<i', raw, name_end)[0]
    affix_id = struct.unpack_from('<i', raw, name_end + 4)[0]
    level_req = struct.unpack_from('<i', raw, name_end + 8)[0]
    assert affix_id == aid
    
    meta_start = name_end + 12  # position after level_req
    
    # Find tier_count by matching with maxroll
    mx = mx_affixes.get(aid)
    mx_tcount = len(mx['tiers']) if mx else 0
    mx_t1_min = mx['tiers'][0]['minValue'] if mx and mx['tiers'] else None
    mx_t1_max = mx['tiers'][0]['maxValue'] if mx and mx['tiers'] else None
    
    # Search for tier_count
    tier_pos = None
    for offset in range(0, 200, 4):
        test_pos = meta_start + offset
        tc = struct.unpack_from('<i', raw, test_pos)[0]
        if tc == mx_tcount and mx_t1_min is not None:
            t1_min = struct.unpack_from('<f', raw, test_pos + 4)[0]
            t1_max = struct.unpack_from('<f', raw, test_pos + 8)[0]
            if abs(t1_min - mx_t1_min) < 0.01 and abs(t1_max - mx_t1_max) < 0.01:
                tier_pos = test_pos
                break
    
    if tier_pos is None:
        print(f"\n[{aid}] {name}: TIER NOT FOUND")
        continue
    
    meta_size = tier_pos - meta_start
    print(f"\n[{aid}] {name} type={atype} lvl={level_req} meta_size={meta_size}B ({meta_size//4} ints):")
    
    # Dump metadata as ints and floats
    for i in range(meta_size // 4):
        p = meta_start + i * 4
        val = struct.unpack_from('<i', raw, p)[0]
        fval = struct.unpack_from('<f', raw, p)[0]
        float_str = f" ({fval:.4f})" if 0.001 < abs(fval) < 10000 and val not in range(-100, 1001) else ""
        print(f"  meta[{i:2d}] +{i*4:3d}: {val:12d}{float_str}")
    
    # Also show tier data briefly
    print(f"  Tier count: {mx_tcount} at pos {tier_pos}")
    for t in range(min(3, mx_tcount)):
        tp = tier_pos + 4 + t * 12
        t_min = struct.unpack_from('<f', raw, tp)[0]
        t_max = struct.unpack_from('<f', raw, tp + 4)[0]
        t_extra = struct.unpack_from('<i', raw, tp + 8)[0]
        print(f"    T{t+1}: {t_min:.4f} - {t_max:.4f} (extra={t_extra})")
