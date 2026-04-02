"""Trace Exulis (entry 469) parse in detail to find the bug."""
import struct

with open(r'c:\eob\scripts\uniquelist.bin', 'rb') as f:
    raw = f.read()

def read_string(raw, pos):
    if pos + 4 > len(raw):
        return None, pos
    strlen = struct.unpack_from('<i', raw, pos)[0]
    if strlen < 0 or strlen > 50000 or pos + 4 + strlen > len(raw):
        return None, pos
    s = raw[pos+4:pos+4+strlen].decode('utf-8', errors='replace')
    next_pos = pos + 4 + strlen
    next_pos = (next_pos + 3) & ~3
    return s, next_pos

HEADER_SIZE = 148

def parse_entry_traced(raw, pos, trace=False):
    start = pos
    name, pos = read_string(raw, pos)
    if name is None: return None, start
    if trace: print(f"  name='{name}' -> pos={pos}")
    dn, pos = read_string(raw, pos)
    if dn is None: return None, start
    if trace: print(f"  displayName='{dn}' -> pos={pos}")
    vn, pos = read_string(raw, pos)
    if vn is None: return None, start
    if trace: print(f"  variantName='{vn}' -> pos={pos}")

    header = [struct.unpack_from('<i', raw, pos + i*4)[0] for i in range(37)]
    uid = header[0]
    lvl = header[13]
    base_type = header[34]
    if trace:
        print(f"  header at {pos}: uid={uid}, lvl={lvl}, base={base_type}")
        for i, v in enumerate(header):
            if v != 0:
                fv = struct.unpack_from('<f', raw, pos + i*4)[0]
                print(f"    h[{i}]={v} (float={fv:.6f})")
    pos += HEADER_SIZE

    mc = struct.unpack_from('<i', raw, pos)[0]
    if trace: print(f"  modCount at {pos}: {mc}")
    pos += 4
    if mc < 0 or mc > 30: return None, start

    mods = []
    for m_i in range(mc):
        fields = struct.unpack_from('<fiifiiiiii', raw, pos)
        if trace:
            print(f"  mod[{m_i}]: val={fields[0]:.4f} canRoll={fields[1]} maxVal={fields[3]:.4f} "
                  f"prop={fields[4]} special={fields[5]} tags={fields[6]} type={fields[8]} hide={fields[9]}")
        pos += 40

    dc = struct.unpack_from('<i', raw, pos)[0]
    if trace: print(f"  descCount at {pos}: {dc}")
    pos += 4

    for i in range(dc):
        s1, pos = read_string(raw, pos)
        s2, pos = read_string(raw, pos)
        pos += 4

    lore, pos = read_string(raw, pos)
    if trace: print(f"  lore='{lore[:50]}...' -> pos={pos}" if lore and len(lore) > 50 else f"  lore='{lore}' -> pos={pos}")

    fc = struct.unpack_from('<i', raw, pos)[0]
    if trace: print(f"  footerCount at {pos}: {fc}")
    pos += 4
    fa = [struct.unpack_from('<i', raw, pos + i*4)[0] for i in range(fc)]
    if trace and fa:
        print(f"  footerArray: {fa}")
        # Also show as floats
        for i, v in enumerate(fa):
            fv = struct.unpack_from('<f', raw, pos + i*4)[0]
            if abs(fv) > 0.001 and abs(fv) < 10000:
                print(f"    fa[{i}]={v} (float={fv:.6f})")
    pos += fc * 4
    t1, t2 = struct.unpack_from('<ii', raw, pos)
    if trace: print(f"  trailing: {t1}, {t2}")
    pos += 8

    return {'uid': uid, 'name': name, 'mods_count': mc, 'footer_count': fc}, pos

# Parse up to and including entry 469 (Exulis) with trace on last 3
total = struct.unpack_from('<i', raw, 44)[0]
pos = 48
for i in range(total):
    trace = (i >= 467)  # trace last few entries
    if trace:
        print(f"\n=== Entry {i} at pos {pos} ===")
    entry, next_pos = parse_entry_traced(raw, pos, trace=trace)
    if entry is None:
        print(f"FAIL at entry {i}, pos {pos}")
        break
    pos = next_pos

print(f"\nFinal pos: {pos}, file size: {len(raw)}, remaining: {len(raw) - pos}")
