"""Detailed analysis of AffixList entry structure.
First entry: 'Void Penetration' (description) + 'Inevitable' (name) + tier data
"""
import struct
import json

with open(r'c:\eob\scripts\affixlist.bin', 'rb') as f:
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

# The name at offset 28 is "MasterAffixesList" (17 chars)
# After name: padded to 52, then data
# Let me check: 28 + 4 + 17 = 49, padded to 52

# Entry count at 52
count = struct.unpack_from('<i', raw, 52)[0]
print(f"Entry count: {count}")

# First entry starts at 56
# Let me step through every byte carefully
pos = 56
print(f"\n=== Entry 0 detailed analysis (from pos {pos}) ===\n")

# Read all strings and ints sequentially
for step in range(100):
    if pos >= len(raw):
        break
    
    # Try reading as string first
    s, npos = read_string(raw, pos)
    if s is not None and len(s) >= 1 and s.isprintable():
        print(f"pos {pos:6d} (step {step:3d}): STRING '{s[:60]}' (len={len(s)}, next={npos})")
        pos = npos
        continue
    
    # Read as int/float
    val = struct.unpack_from('<i', raw, pos)[0]
    fval = struct.unpack_from('<f', raw, pos)[0]
    
    # Check if it looks like a meaningful float
    if 0.001 < abs(fval) < 10000 and val != 0:
        print(f"pos {pos:6d} (step {step:3d}): int={val:12d}  float={fval:.6f}")
    else:
        print(f"pos {pos:6d} (step {step:3d}): int={val:12d}")
    pos += 4

# Now let me try to find all affix names by scanning for known patterns
# Affix names are followed by (affixType, affixID, ...) where affixID increments
print(f"\n\n=== Finding affix names (looking for sequential IDs) ===\n")

pos = 56
found_affixes = []
while pos < min(len(raw), 20000):
    s, npos = read_string(raw, pos)
    if s and len(s) >= 2 and s.isprintable() and npos + 8 <= len(raw):
        ctx1 = struct.unpack_from('<i', raw, npos)[0]
        ctx2 = struct.unpack_from('<i', raw, npos + 4)[0]
        # Check if ctx2 looks like a sequential affix ID
        expected_id = len(found_affixes)
        if ctx2 == expected_id and ctx1 in (0, 1, 2, 3, 4):
            found_affixes.append({
                'pos': pos, 'name': s, 'type': ctx1, 'id': ctx2,
                'ctx': [struct.unpack_from('<i', raw, npos + i*4)[0] for i in range(5)]
            })
            # Skip past this entry
            pos = npos + 4  # Only skip the type field, let the loop find next
            continue
    pos += 4

print(f"Found {len(found_affixes)} affixes with sequential IDs")
for a in found_affixes[:20]:
    print(f"  [{a['id']:3d}] '{a['name']}'  type={a['type']}  ctx={a['ctx']}  pos={a['pos']}")

if len(found_affixes) >= 2:
    # Calculate distance between entries
    for i in range(min(5, len(found_affixes)-1)):
        a1 = found_affixes[i]
        a2 = found_affixes[i+1]
        dist = a2['pos'] - a1['pos']
        print(f"\n  Entry {i} -> {i+1}: distance={dist} bytes ({dist//4} ints)")
