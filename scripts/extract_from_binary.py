"""Re-extract UniqueList from game files and export to uniques-import.json.
Source of truth: C:\ledata\Last Epoch_Data\resources.assets
"""
import struct, json, os

GAME_PATH = r'C:\ledata\Last Epoch_Data'
BIN_FILE = r'c:\eob\scripts\uniquelist.bin'
OUT_FILE = r'c:\eob\packages\game-data\src\data\uniques-import.json'

# ── Step 1: Extract binary from game assets ──

def extract_uniquelist():
    """Extract UniqueList MonoBehaviour from resources.assets."""
    try:
        import UnityPy
    except ImportError:
        print("UnityPy not installed. Install with: pip install UnityPy")
        return None

    assets_path = os.path.join(GAME_PATH, "resources.assets")
    if not os.path.exists(assets_path):
        print(f"Game file not found: {assets_path}")
        return None

    print(f"Loading {assets_path}...")
    env = UnityPy.load(assets_path)

    for obj in env.objects:
        if obj.type.name == 'MonoBehaviour':
            raw = obj.get_raw_data()
            if len(raw) < 28:
                continue
            script_path_id = struct.unpack_from('<q', raw, 20)[0]
            if script_path_id == 9668:
                print(f"Found UniqueList: {len(raw)} bytes (script_path_id=9668)")
                with open(BIN_FILE, 'wb') as f:
                    f.write(raw)
                print(f"Saved to {BIN_FILE}")
                return raw

    print("UniqueList not found in resources.assets!")
    return None


# ── Step 2: Parse binary ──

def read_string(raw, pos):
    if pos + 4 > len(raw):
        return None, pos
    strlen = struct.unpack_from('<i', raw, pos)[0]
    if strlen < 0 or strlen > 50000 or pos + 4 + strlen > len(raw):
        return None, pos
    s = raw[pos+4:pos+4+strlen].decode('utf-8', errors='replace')
    next_pos = pos + 4 + strlen
    next_pos = (next_pos + 3) & ~3  # 4-byte alignment
    return s, next_pos


def parse_entry(raw, pos):
    start = pos

    # 1. name, displayName, variantName (3 strings)
    name, pos = read_string(raw, pos)
    if name is None: return None, start
    dn, pos = read_string(raw, pos)
    if dn is None: return None, start
    vn, pos = read_string(raw, pos)
    if vn is None: return None, start

    # 2. Header (148 bytes = 37 int32s)
    HEADER_SIZE = 148
    if pos + HEADER_SIZE > len(raw): return None, start
    header = [struct.unpack_from('<i', raw, pos + i*4)[0] for i in range(37)]
    uid = header[0]
    lvl = header[13]
    legend_type = header[14]
    base_type = header[34]
    pos += HEADER_SIZE

    # 3. Mods (count + 40 bytes each)
    mc = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if mc < 0 or mc > 30: return None, start

    mods = []
    for _ in range(mc):
        if pos + 40 > len(raw): return None, start
        fields = struct.unpack_from('<fiifiiiiii', raw, pos)
        mods.append({
            'value': round(fields[0], 6),
            'canRoll': bool(fields[1]),
            'maxValue': round(fields[3], 6),
            'property': fields[4],
            'specialTag': fields[5],
            'tags': fields[6],
            'type': fields[8],          # 0=flat, 1=increased%, 2=more%
            'hideInTooltip': bool(fields[9]),
        })
        pos += 40

    # 4. Descriptions (count + per-desc: string + string + int32)
    dc = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if dc < 0 or dc > 50: return None, start
    descs = []
    for _ in range(dc):
        s1, pos = read_string(raw, pos)
        s2, pos = read_string(raw, pos)
        if s1 is None or s2 is None: return None, start
        pos += 4  # trailing int
        if s1:
            descs.append(s1)
        if s2:
            descs.append(s2)

    # 5. Lore (string)
    lore, pos = read_string(raw, pos)
    if lore is None: return None, start

    # 6. Footer (count + count*int32 + 2 trailing int32s)
    fc = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if fc < 0 or fc > 100: return None, start
    fa = [struct.unpack_from('<i', raw, pos + i*4)[0] for i in range(fc)]
    pos += fc * 4
    if pos + 8 > len(raw): return None, start
    pos += 8

    return {
        'name': name, 'displayName': dn, 'variantName': vn,
        'uniqueID': uid, 'levelRequirement': lvl,
        'legendaryType': legend_type, 'baseType': base_type,
        'mods': mods, 'descriptions': descs, 'lore': lore,
        'subTypes': fa,
    }, pos


# ── Step 3: Convert to import format ──

def to_import_format(entry):
    """Convert a parsed binary entry to the uniques-import.json format."""
    item = {
        'uniqueID': entry['uniqueID'],
        'name': entry['displayName'] if entry['displayName'] else entry['name'],
        'internalName': entry['name'],
        'baseType': entry['baseType'],
        'subTypes': entry['subTypes'],
        'mods': [],
        'legendaryType': entry['legendaryType'],
        'levelRequirement': entry['levelRequirement'],
        'loreText': entry['lore'],
    }

    if entry['displayName'] and entry['displayName'] != entry['name']:
        item['displayName'] = entry['displayName']
    if entry['variantName']:
        item['variantName'] = entry['variantName']

    for mod in entry['mods']:
        m = {'property': mod['property'], 'value': mod['value']}
        if mod['canRoll']:
            m['canRoll'] = True
            m['maxValue'] = mod['maxValue']
        if mod['tags']:
            m['tags'] = mod['tags']
        if mod['specialTag']:
            m['specialTag'] = mod['specialTag']
        if mod['type']:
            m['type'] = mod['type']
        if mod['hideInTooltip']:
            m['hideInTooltip'] = True
        item['mods'].append(m)

    if entry['descriptions']:
        item['tooltipDescriptions'] = entry['descriptions']

    return item


# ── Main ──

def main():
    # Try to re-extract from game files
    print("=== Extracting UniqueList from game files ===")
    raw = extract_uniquelist()

    if raw is None:
        print("\nFalling back to cached binary...")
        if not os.path.exists(BIN_FILE):
            print(f"No cached binary at {BIN_FILE}")
            return
        with open(BIN_FILE, 'rb') as f:
            raw = f.read()
        print(f"Loaded {len(raw)} bytes from cache")

    # Parse
    total = struct.unpack_from('<i', raw, 44)[0]
    print(f"\nTotal entries in binary: {total}")

    pos = 48
    entries = []
    for i in range(total):
        entry, next_pos = parse_entry(raw, pos)
        if entry is None:
            print(f"FAIL at entry {i}, pos {pos}")
            break
        entries.append(entry)
        pos = next_pos

    print(f"Parsed {len(entries)} / {total} entries")

    # Convert and export
    output = [to_import_format(e) for e in entries]

    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, separators=(',', ':'))

    size = os.path.getsize(OUT_FILE)
    print(f"\nExported {len(output)} uniques to {OUT_FILE}")
    print(f"File size: {size:,} bytes ({size//1024} KB)")

    # Stats
    total_mods = sum(len(e['mods']) for e in output)
    with_descs = sum(1 for e in output if e.get('tooltipDescriptions'))
    zero_mods = [e for e in output if len(e['mods']) == 0]

    print(f"\nTotal mods: {total_mods}")
    print(f"Items with tooltipDescriptions: {with_descs}")
    print(f"Items with 0 mods: {len(zero_mods)}")
    for e in zero_mods:
        print(f"  #{e['uniqueID']} {e['name']}")


if __name__ == '__main__':
    main()
