"""Extract and analyze AffixList binary from resources.assets.
AffixList: 377,648 bytes, path_id=269867, script_path_id=336
"""
import UnityPy
import os
import struct
import json

GAME_PATH = r"C:\ledata\Last Epoch_Data"
AFFIX_BIN = r"c:\eob\scripts\affixlist.bin"

# Extract raw binary
env = UnityPy.load(os.path.join(GAME_PATH, "resources.assets"))
for obj in env.objects:
    if obj.type.name == 'MonoBehaviour':
        raw = obj.get_raw_data()
        if len(raw) < 28:
            continue
        script_path_id = struct.unpack_from('<q', raw, 20)[0]
        if script_path_id == 336:
            with open(AFFIX_BIN, 'wb') as f:
                f.write(raw)
            print(f"Saved AffixList: {len(raw)} bytes")
            break

with open(AFFIX_BIN, 'rb') as f:
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

# Examine file structure
# First: skip MonoBehaviour header (same as UniqueList)
# Offsets 0-43: MB header, offset 44: array count?
print(f"\nFile size: {len(raw)} bytes")
print(f"\nFirst 60 bytes (as ints):")
for i in range(15):
    val = struct.unpack_from('<i', raw, i*4)[0]
    fval = struct.unpack_from('<f', raw, i*4)[0]
    print(f"  [{i}] +{i*4}: int={val:12d}  float={fval:.6f}")

# Try to read the name field like UniqueList
name_at_28, _ = read_string(raw, 28)
print(f"\nString at offset 28: '{name_at_28}'")

count_at_44 = struct.unpack_from('<i', raw, 44)[0]
print(f"Int at offset 44: {count_at_44}")

# Check for array at offset 48 (like UniqueList)
print(f"\nData from offset 48:")
pos = 48
for i in range(30):
    if pos + 4 > len(raw):
        break
    val = struct.unpack_from('<i', raw, pos)[0]
    fval = struct.unpack_from('<f', raw, pos + 0)[0] if pos + 4 <= len(raw) else 0
    s, _ = read_string(raw, pos)
    extra = ""
    if s and s.isprintable() and len(s) > 1:
        extra = f"  STR='{s[:50]}'"
    print(f"  [{i:2d}] pos {pos}: int={val:12d}  float={fval:.6f}{extra}")
    pos += 4

# The AffixImport CSV had 115 idol affixes with 47 fields each
# The AffixList binary might have similar structure
# Try to find the first entry by looking for recognizable patterns
# Affixes have: affixID, name, tier, property, value, tags, etc.

# Let's try to find strings that look like affix names
print("\n\nSearching for affix-like strings in first 5000 bytes:")
pos = 48
scan_end = min(5000, len(raw))
while pos < scan_end:
    s, npos = read_string(raw, pos)
    if s and len(s) > 3 and s.isprintable():
        # Check if next few bytes look reasonable (small ints, not garbage)
        ctx = []
        for j in range(5):
            if npos + j*4 + 4 <= len(raw):
                ctx.append(struct.unpack_from('<i', raw, npos + j*4)[0])
        print(f"  pos {pos}: '{s[:60]}' ctx={ctx}")
    pos += 4
