"""Cross-reference game data headers/footers with maxroll baseType/subTypes."""
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

HEADER_SIZE = 148

def parse_entry(raw, pos):
    start = pos
    name, pos = read_string(raw, pos)
    if name is None: return None, start
    dn, pos = read_string(raw, pos)
    if dn is None: return None, start
    vn, pos = read_string(raw, pos)
    if vn is None: return None, start
    
    if pos + HEADER_SIZE > len(raw): return None, start
    header = [struct.unpack_from('<i', raw, pos + i*4)[0] for i in range(HEADER_SIZE // 4)]
    header_f = [struct.unpack_from('<f', raw, pos + i*4)[0] for i in range(HEADER_SIZE // 4)]
    uid = header[0]
    lvl = header[13]
    pos += HEADER_SIZE
    
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
    pos += 4
    fa = [struct.unpack_from('<i', raw, pos + i*4)[0] for i in range(fc)]
    pos += fc * 4
    ft = (struct.unpack_from('<i', raw, pos)[0], struct.unpack_from('<i', raw, pos+4)[0])
    pos += 8
    
    return {
        'name': name, 'uid': uid, 'lvl': lvl, 'mc': mc,
        'header': header, 'header_f': header_f,
        'footerArray': fa, 'footerTrailing': ft,
    }, pos

# Parse all entries
pos = 48
entries = []
for i in range(470):
    entry, pos = parse_entry(raw, pos)
    if entry is None:
        print(f"Failed at {i}")
        break
    entries.append(entry)

print(f"Parsed {len(entries)} entries\n")

# Cross-reference baseType and subTypes
print("=== Cross-reference: baseType ===")
print(f"{'Name':<30} {'uid':>4} {'mx_base':>7} {'mx_sub':<20} {'footerArr':<30} {'trail':<10}")
for entry in entries[:30]:
    mx = maxroll_by_id.get(entry['uid'])
    if not mx: continue
    mx_bt = mx['baseType']
    mx_st = mx['subTypes']
    fa = entry['footerArray']
    ft = entry['footerTrailing']
    print(f"{entry['name']:<30} {entry['uid']:>4} {mx_bt:>7} {str(mx_st):<20} {str(fa):<30} {str(ft):<10}")

# Try to find which footer position corresponds to baseType
print("\n=== Hypothesis testing: which footer field = baseType? ===")
for guess_field in ['trailing[0]', 'trailing[1]', 'footerArr[0]', 'footerArr[-1]', 'footerArr[-2]']:
    matches = 0
    total = 0
    for entry in entries:
        mx = maxroll_by_id.get(entry['uid'])
        if not mx: continue
        mx_bt = mx['baseType']
        fa = entry['footerArray']
        ft = entry['footerTrailing']
        
        if guess_field == 'trailing[0]':
            val = ft[0]
        elif guess_field == 'trailing[1]':
            val = ft[1]
        elif guess_field == 'footerArr[0]' and fa:
            val = fa[0]
        elif guess_field == 'footerArr[-1]' and fa:
            val = fa[-1]
        elif guess_field == 'footerArr[-2]' and len(fa) >= 2:
            val = fa[-2]
        else:
            continue
            
        total += 1
        if val == mx_bt:
            matches += 1
    print(f"  {guess_field}: {matches}/{total} match")

# Try header fields
print("\n=== Hypothesis: which header field = baseType? ===")
for h_idx in range(37):
    matches = 0
    total = 0
    for entry in entries:
        mx = maxroll_by_id.get(entry['uid'])
        if not mx: continue
        mx_bt = mx['baseType']
        total += 1
        if entry['header'][h_idx] == mx_bt:
            matches += 1
    if matches > total * 0.8:
        print(f"  header[{h_idx}] (+{h_idx*4}): {matches}/{total} match")

# Check subTypes mapping
print("\n=== SubTypes analysis ===")
for entry in entries[:20]:
    mx = maxroll_by_id.get(entry['uid'])
    if not mx: continue
    mx_st = mx['subTypes']
    fa = entry['footerArray']
    # Check if subTypes values appear in footerArray
    in_footer = all(s in fa for s in mx_st)
    print(f"  [{entry['uid']}] {entry['name']:<25} mx_sub={str(mx_st):<15} footer={fa} {'MATCH' if in_footer else 'NO'}")

# Check legendaryType
print("\n=== LegendaryType analysis ===")
for h_idx in range(37):
    matches = 0
    total = 0
    for entry in entries:
        mx = maxroll_by_id.get(entry['uid'])
        if not mx: continue
        mx_lt = mx.get('legendaryType', 0)
        total += 1
        if entry['header'][h_idx] == mx_lt:
            matches += 1
    if matches > total * 0.8:
        print(f"  header[{h_idx}] (+{h_idx*4}): {matches}/{total} match (legendaryType)")
