"""Debug entry 11 (Exsanguinous) parsing failure."""
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

# Start at pos 6268 (where entry 11 should be)
pos = 6268
print(f"Parsing at pos {pos}")

# Name
name, npos = read_string(raw, pos)
print(f"Name: '{name}' (pos {pos} -> {npos})")

# DisplayName
dname, dpos = read_string(raw, npos)
print(f"DisplayName: '{dname}' (pos {npos} -> {dpos})")

# Header - dump all 38 ints
print(f"\nHeader at pos {dpos}:")
for i in range(38):
    val = struct.unpack_from('<i', raw, dpos + i*4)[0]
    fval = struct.unpack_from('<f', raw, dpos + i*4)[0]
    print(f"  [{i:2d}] +{i*4:3d}: int={val:12d}  float={fval:12.6f}")

uid = struct.unpack_from('<i', raw, dpos + 4)[0]
lvl = struct.unpack_from('<i', raw, dpos + 56)[0]
print(f"\n  uid={uid}, level={lvl}")

pos = dpos + 152
mod_count = struct.unpack_from('<i', raw, pos)[0]
print(f"\nMod count: {mod_count} at pos {pos}")
pos += 4

for m in range(mod_count):
    fields = struct.unpack_from('<fiifiiiiii', raw, pos)
    print(f"  Mod {m}: val={fields[0]:.4f} canRoll={fields[1]} cat={fields[2]} "
          f"max={fields[3]:.4f} prop={fields[4]} sptag={fields[5]} tags={fields[6]} "
          f"a={fields[7]} dispType={fields[8]} c={fields[9]}")
    pos += 40

# desc_count
desc_count = struct.unpack_from('<i', raw, pos)[0]
print(f"\nDesc count: {desc_count} at pos {pos}")
pos += 4

for i in range(desc_count):
    s, pos = read_string(raw, pos)
    print(f"  Desc {i}: '{s[:70] if s else 'NONE'}' (next pos: {pos})")
    if s is None:
        print("  FAILED to read desc string!")
        break
    f1 = struct.unpack_from('<i', raw, pos)[0]
    f2 = struct.unpack_from('<i', raw, pos+4)[0]
    print(f"    f1={f1}, f2={f2}")
    pos += 8

# Lore
lore, pos = read_string(raw, pos)
print(f"\nLore: '{lore[:70] if lore else 'NONE'}' (next pos: {pos})")

# Footer
print(f"\nFooter data from pos {pos}:")
for i in range(15):
    val = struct.unpack_from('<i', raw, pos + i*4)[0]
    s, _ = read_string(raw, pos + i*4)
    extra = f"  STR='{s[:40]}'" if s and s.isprintable() and len(s) > 2 else ""
    print(f"  [{i}] pos {pos + i*4}: int={val}{extra}")
