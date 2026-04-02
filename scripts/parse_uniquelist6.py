"""Complete UniqueList parser v6 — corrected structure:
  Entry layout:
  - name (string)
  - displayName (string)
  - variantName (string, usually empty)
  - header (148 bytes = 37 ints): uid at +0, levelReq at +52
  - modCount (int) + mods (40 bytes each)
    mod format '<fiifiiiiii': value, canRoll, modCategory, maxValue,
      property, specialTag, tags, unknown_a, type(display), unknown_c
  - descCount (int) + descCount * (string + string + int)
  - lore (string)
  - footerArrayCount (int) + footerArray[count] + 2 trailing ints
"""
import struct
import json

UNIQUELIST_BIN = r'c:\eob\scripts\uniquelist.bin'
MAXROLL_JSON = r'c:\eob\packages\game-data\src\data\uniques-import.json'
GAME_PATH = r'C:\ledata\Last Epoch_Data'

def load_uniquelist_binary():
    """Load or extract UniqueList binary."""
    try:
        with open(UNIQUELIST_BIN, 'rb') as f:
            return f.read()
    except FileNotFoundError:
        import UnityPy, os
        env = UnityPy.load(os.path.join(GAME_PATH, "resources.assets"))
        for obj in env.objects:
            if obj.type.name == 'MonoBehaviour':
                raw = obj.get_raw_data()
                if len(raw) < 28:
                    continue
                script_path_id = struct.unpack_from('<q', raw, 20)[0]
                if script_path_id == 9668:
                    with open(UNIQUELIST_BIN, 'wb') as f:
                        f.write(raw)
                    return raw
        raise RuntimeError("UniqueList not found in resources.assets")

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

def parse_entry(raw, pos):
    start = pos

    # 1. Name (internal)
    name, pos = read_string(raw, pos)
    if name is None:
        return None, start, f"name failed at {start}"

    # 2. Display name
    display_name, pos = read_string(raw, pos)
    if display_name is None:
        return None, start, f"displayName failed"

    # 3. Variant name (usually empty, non-empty for variant items)
    variant_name, pos = read_string(raw, pos)
    if variant_name is None:
        return None, start, f"variantName failed"

    # 4. Header (148 bytes = 37 ints)
    HEADER_SIZE = 148
    if pos + HEADER_SIZE > len(raw):
        return None, start, f"header overflow at {pos}"
    uid = struct.unpack_from('<i', raw, pos)[0]      # +0
    lvl = struct.unpack_from('<i', raw, pos + 52)[0]  # +52
    pos += HEADER_SIZE

    # 5. Mod count + mods (40 bytes each)
    mod_count = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if mod_count < 0 or mod_count > 30:
        return None, start, f"bad mod_count={mod_count} at {pos-4}"

    mods = []
    for m in range(mod_count):
        if pos + 40 > len(raw):
            return None, start, f"mod overflow"
        fields = struct.unpack_from('<fiifiiiiii', raw, pos)
        mods.append({
            'value': round(fields[0], 6),
            'canRoll': bool(fields[1]),
            'modCategory': fields[2],
            'maxValue': round(fields[3], 6),
            'property': fields[4],
            'specialTag': fields[5],
            'tags': fields[6],
            'unknown_a': fields[7],
            'type': fields[8],      # display type: 0=flat, 1=increased%, 2=more%
            'unknown_c': fields[9],
        })
        pos += 40

    # 6. Descriptions: count + count * (string + string + int)
    desc_count = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if desc_count < 0 or desc_count > 50:
        return None, start, f"bad desc_count={desc_count}"

    descriptions = []
    for i in range(desc_count):
        s1, pos = read_string(raw, pos)
        if s1 is None:
            return None, start, f"desc[{i}].s1 failed at {pos}"
        s2, pos = read_string(raw, pos)
        if s2 is None:
            return None, start, f"desc[{i}].s2 failed at {pos}"
        trailing = struct.unpack_from('<i', raw, pos)[0]
        pos += 4
        descriptions.append({'primary': s1, 'secondary': s2, 'trailing': trailing})

    # 7. Lore
    lore, pos = read_string(raw, pos)
    if lore is None:
        return None, start, f"lore failed at {pos}"

    # 8. Footer: count + count*int + 2 trailing ints
    footer_count = struct.unpack_from('<i', raw, pos)[0]
    pos += 4
    if footer_count < 0 or footer_count > 100:
        return None, start, f"bad footer_count={footer_count}"

    if pos + (footer_count + 2) * 4 > len(raw):
        return None, start, f"footer overflow"

    footer_array = [struct.unpack_from('<i', raw, pos + i*4)[0] for i in range(footer_count)]
    pos += footer_count * 4
    footer_t1 = struct.unpack_from('<i', raw, pos)[0]
    footer_t2 = struct.unpack_from('<i', raw, pos + 4)[0]
    pos += 8

    return {
        'name': name,
        'displayName': display_name if display_name else name,
        'variantName': variant_name,
        'uniqueID': uid,
        'levelRequirement': lvl,
        'mods': mods,
        'descriptions': descriptions,
        'lore': lore,
        'footerArray': footer_array,
        'footerTrailing': (footer_t1, footer_t2),
    }, pos, None


def main():
    raw = load_uniquelist_binary()

    with open(MAXROLL_JSON, 'r') as f:
        maxroll_data = json.load(f)
    maxroll_by_id = {item['uniqueID']: item for item in maxroll_data}

    total_count = struct.unpack_from('<i', raw, 44)[0]
    print(f"Total entries in binary: {total_count}")

    pos = 48
    entries = []
    for i in range(total_count):
        entry, next_pos, err = parse_entry(raw, pos)
        if entry is None:
            print(f"\nFAILED at entry {i}, pos {pos}: {err}")
            for j in range(10):
                p = pos + j * 4
                if p + 4 <= len(raw):
                    val = struct.unpack_from('<i', raw, p)[0]
                    s, _ = read_string(raw, p)
                    extra = f" STR='{s[:40]}'" if s and s.isprintable() and len(s) > 2 else ""
                    print(f"  [{j}] pos {p}: int={val}{extra}")
            break
        entries.append(entry)
        pos = next_pos

    print(f"Successfully parsed {len(entries)} / {total_count} entries")

    # Cross-validate with maxroll
    type_ok = type_bad = prop_ok = prop_bad = val_ok = val_bad = 0
    tag_ok = tag_bad = special_ok = special_bad = 0
    for entry in entries:
        mx = maxroll_by_id.get(entry['uniqueID'])
        if not mx:
            continue
        mx_mods = mx.get('mods', [])
        for gm, mm in zip(entry['mods'], mx_mods):
            type_ok += 1 if gm['type'] == mm.get('type', 0) else 0
            type_bad += 0 if gm['type'] == mm.get('type', 0) else 1
            prop_ok += 1 if gm['property'] == mm.get('property', -1) else 0
            prop_bad += 0 if gm['property'] == mm.get('property', -1) else 1
            val_ok += 1 if abs(gm['value'] - mm.get('value', 0)) < 0.01 else 0
            val_bad += 0 if abs(gm['value'] - mm.get('value', 0)) < 0.01 else 1
            tag_ok += 1 if gm['tags'] == mm.get('tags', 0) else 0
            tag_bad += 0 if gm['tags'] == mm.get('tags', 0) else 1
            special_ok += 1 if gm['specialTag'] == mm.get('specialTag', 0) else 0
            special_bad += 0 if gm['specialTag'] == mm.get('specialTag', 0) else 1

    print(f"\nCross-validation (game vs maxroll):")
    print(f"  type:       {type_ok} ok, {type_bad} mismatch")
    print(f"  property:   {prop_ok} ok, {prop_bad} mismatch")
    print(f"  value:      {val_ok} ok, {val_bad} mismatch")
    print(f"  tags:       {tag_ok} ok, {tag_bad} mismatch")
    print(f"  specialTag: {special_ok} ok, {special_bad} mismatch")

    # Show some entries
    for entry in entries[:5]:
        uid = entry['uniqueID']
        dn = entry['displayName']
        vn = entry['variantName']
        print(f"\n[{uid}] {entry['name']}" +
              (f" / {dn}" if dn != entry['name'] else "") +
              (f" ({vn})" if vn else ""))
        print(f"  Level: {entry['levelRequirement']}, Mods: {len(entry['mods'])}")
        for i, mod in enumerate(entry['mods']):
            print(f"  Mod {i}: prop={mod['property']} val={mod['value']:.4f}-{mod['maxValue']:.4f} "
                  f"type={mod['type']} tags={mod['tags']} special={mod['specialTag']}")

    # Show the variant entry
    for entry in entries:
        if entry['variantName']:
            uid = entry['uniqueID']
            print(f"\n[{uid}] {entry['name']} / {entry['displayName']} ({entry['variantName']})")
            print(f"  Level: {entry['levelRequirement']}, Mods: {len(entry['mods'])}")
            for i, mod in enumerate(entry['mods']):
                print(f"  Mod {i}: prop={mod['property']} val={mod['value']:.4f}-{mod['maxValue']:.4f} "
                      f"type={mod['type']} tags={mod['tags']} special={mod['specialTag']}")
            break  # Just show the first variant

    # Count entries with variants
    variants = [e for e in entries if e['variantName']]
    print(f"\n{len(variants)} entries have variant names")

if __name__ == '__main__':
    main()
