"""
Full UniqueList parser based on reverse-engineered structure.

Entry layout:
1. Internal name (string)
2. Display name (string, may be empty if same)
3. Fixed header (152 bytes):
   - h[4] = uniqueID (int)
   - h[8] = ??? 
   - h[52] = ???
   - h[56] = levelRequirement (int)
   - h[92] = ??? (always 1?)
   - h[116] = ??? (float, always 1.0?)
4. Mod count (int)
5. Mods (40 bytes each):
   +0:  specialTag
   +4:  hideInTooltip
   +8:  unknown
   +12: value (float)
   +16: canRoll
   +20: type (0=flat, 1=increased, 2=more)
   +24: maxValue (float)
   +28: property
   +32: unknown2
   +36: tags
6. Description count (int)
7. Description strings (with possible metadata between)
8. Lore text (string)
9. Footer data (item type references)
"""
import UnityPy
import os
import struct
import json

GAME_PATH = r"C:\ledata\Last Epoch_Data"

with open(r'c:\eob\packages\game-data\src\data\uniques-import.json', 'r') as f:
    maxroll_data = json.load(f)
maxroll_by_id = {item['uniqueID']: item for item in maxroll_data}
maxroll_by_name = {item['name']: item for item in maxroll_data}

def read_string(raw, pos):
    if pos + 4 > len(raw):
        return None, pos
    strlen = struct.unpack_from('<i', raw, pos)[0]
    if strlen < 0 or strlen > 10000 or pos + 4 + strlen > len(raw):
        return None, pos
    try:
        s = raw[pos+4:pos+4+strlen].decode('utf-8')
    except:
        return None, pos
    next_pos = pos + 4 + strlen
    next_pos = (next_pos + 3) & ~3
    return s, next_pos

def try_read_string(raw, pos):
    """Try to read a string, return None if invalid."""
    if pos + 4 > len(raw):
        return None, pos
    strlen = struct.unpack_from('<i', raw, pos)[0]
    if strlen < 0 or strlen > 5000 or pos + 4 + strlen > len(raw):
        return None, pos
    try:
        s = raw[pos+4:pos+4+strlen].decode('utf-8')
        if all(c.isprintable() or c in '\n\r\t' for c in s):
            next_pos = pos + 4 + strlen
            next_pos = (next_pos + 3) & ~3
            return s, next_pos
    except:
        pass
    return None, pos

env = UnityPy.load(os.path.join(GAME_PATH, "resources.assets"))

for obj in env.objects:
    if obj.type.name == 'MonoBehaviour':
        raw = obj.get_raw_data()
        if len(raw) < 28:
            continue
        script_path_id = struct.unpack_from('<q', raw, 20)[0]
        if script_path_id != 9668:  # UniqueList
            continue
        
        total_count = struct.unpack_from('<i', raw, 44)[0]
        print(f"UniqueList: {len(raw)} bytes, {total_count} entries\n")
        
        pos = 48
        parsed = []
        errors = 0
        
        for entry_idx in range(total_count):
            entry_start = pos
            
            # 1. Read internal name
            name, pos = read_string(raw, pos)
            if name is None:
                print(f"  ERROR at entry {entry_idx}: can't read name at {entry_start}")
                errors += 1
                break
            
            # 2. Read display name (may be empty)
            display_name, pos = read_string(raw, pos)
            if display_name is None:
                # Display name might be missing for some entries
                display_name = ''
                pos = entry_start + 4  # reset

            # 3. Read 152-byte fixed header
            if pos + 152 > len(raw):
                print(f"  ERROR at entry {entry_idx}: not enough data for header")
                errors += 1
                break
            
            header = raw[pos:pos+152]
            unique_id = struct.unpack_from('<i', header, 4)[0]
            level_req = struct.unpack_from('<i', header, 56)[0]
            # Extract all header fields for analysis
            header_fields = {}
            for i in range(0, 152, 4):
                ival = struct.unpack_from('<i', header, i)[0]
                if ival != 0:
                    fval = struct.unpack_from('<f', header, i)[0]
                    header_fields[i] = ival
            
            pos += 152
            
            # 4. Read mod count
            mod_count = struct.unpack_from('<i', raw, pos)[0]
            pos += 4
            
            # 5. Read mods
            mods = []
            for m in range(mod_count):
                if pos + 40 > len(raw):
                    break
                fields = struct.unpack_from('<iiifiiifii', raw, pos)
                mod = {
                    'specialTag': fields[0],
                    'hideInTooltip': bool(fields[1]),
                    'unknown1': fields[2],
                    'value': round(fields[3], 6),
                    'canRoll': bool(fields[4]),
                    'type': fields[5],
                    'maxValue': round(fields[6], 6),
                    'property': fields[7],
                    'unknown2': fields[8],
                    'tags': fields[9],
                }
                mods.append(mod)
                pos += 40
            
            # 6. Read description count  
            desc_count = struct.unpack_from('<i', raw, pos)[0]
            pos += 4
            
            # 7. Read descriptions
            descs = []
            for d in range(desc_count):
                s, pos = try_read_string(raw, pos)
                if s is not None:
                    descs.append(s)
                else:
                    # Maybe there's metadata between descriptions
                    # Try skipping 4 or 8 bytes
                    for skip in [4, 8, 12]:
                        s, new_pos = try_read_string(raw, pos + skip)
                        if s is not None:
                            pos = new_pos
                            descs.append(s)
                            break
                    else:
                        break
            
            # 8. Read lore text
            lore, pos = try_read_string(raw, pos)
            if lore is None:
                # Try skipping some bytes
                for skip in range(1, 20):
                    lore, new_pos = try_read_string(raw, pos + skip)
                    if lore is not None and len(lore) > 10:
                        pos = new_pos
                        break
                else:
                    lore = ''
            
            # 9. Read footer (variable, scan to find next entry's name)
            # Read remaining ints until next string that looks like a name
            footer_start = pos
            footer_ints = []
            while pos < len(raw) - 4:
                s, test_pos = try_read_string(raw, pos)
                if s is not None and len(s) >= 2 and not s.startswith('[') and not s.startswith('<'):
                    # This could be the next entry's name
                    # Check if it's a reasonable name
                    if any(c.isalpha() for c in s[:5]):
                        break
                ival = struct.unpack_from('<i', raw, pos)[0]
                footer_ints.append(ival)
                pos += 4
            
            entry = {
                'name': name,
                'displayName': display_name,
                'uniqueID': unique_id,
                'levelRequirement': level_req,
                'modCount': mod_count,
                'mods': mods,
                'descCount': desc_count,
                'descriptions': descs,
                'loreText': lore,
                'footerInts': footer_ints,
                'headerFields': header_fields,
                'entrySize': pos - entry_start,
            }
            parsed.append(entry)
        
        print(f"Successfully parsed {len(parsed)} / {total_count} entries, {errors} errors\n")
        
        # Cross-reference first 20 entries with maxroll
        print("=== Cross-reference with maxroll ===")
        match_count = 0
        for entry in parsed[:20]:
            uid = entry['uniqueID']
            print(f"\n  [{uid}] {entry['name']}" + 
                  (f" / {entry['displayName']}" if entry['displayName'] else ""))
            print(f"    Level: {entry['levelRequirement']}, Mods: {entry['modCount']}, "
                  f"Descs: {entry['descCount']}/{len(entry['descriptions'])}")
            print(f"    Lore: {entry['loreText'][:60]}...")
            print(f"    Footer: {entry['footerInts']}")
            print(f"    Header non-zero: {entry['headerFields']}")
            
            # Show mods
            for i, mod in enumerate(entry['mods']):
                print(f"    Mod {i}: prop={mod['property']} val={mod['value']}-{mod['maxValue']} "
                      f"type={mod['type']} tags={mod['tags']} special={mod['specialTag']} "
                      f"hide={mod['hideInTooltip']} roll={mod['canRoll']} "
                      f"unk1={mod['unknown1']} unk2={mod['unknown2']}")
            
            # Compare with maxroll
            if uid in maxroll_by_id:
                mx = maxroll_by_id[uid]
                print(f"    --- Maxroll comparison ---")
                if mx['name'] != entry['name']:
                    print(f"    NAME MISMATCH: game='{entry['name']}' vs maxroll='{mx['name']}'")
                
                mx_level = mx.get('levelRequirement', 0)
                if mx_level != entry['levelRequirement']:
                    print(f"    LEVEL: game={entry['levelRequirement']} vs maxroll={mx_level}")
                
                mx_mods = mx.get('mods', [])
                if len(mx_mods) != entry['modCount']:
                    print(f"    MOD COUNT: game={entry['modCount']} vs maxroll={len(mx_mods)}")
                else:
                    for i, (gm, mm) in enumerate(zip(entry['mods'], mx_mods)):
                        mismatches = []
                        if gm['property'] != mm.get('property'):
                            mismatches.append(f"prop: {gm['property']} vs {mm.get('property')}")
                        if abs(gm['value'] - mm.get('value', 0)) > 0.001:
                            mismatches.append(f"val: {gm['value']} vs {mm.get('value')}")
                        if abs(gm['maxValue'] - mm.get('maxValue', gm['value'])) > 0.001:
                            mismatches.append(f"max: {gm['maxValue']} vs {mm.get('maxValue')}")
                        if gm['tags'] != mm.get('tags', 0):
                            mismatches.append(f"tags: {gm['tags']} vs {mm.get('tags')}")
                        if gm['specialTag'] != mm.get('specialTag', 0):
                            mismatches.append(f"special: {gm['specialTag']} vs {mm.get('specialTag', 0)}")
                        if gm['type'] != mm.get('type', 0):
                            mismatches.append(f"type: {gm['type']} vs {mm.get('type', 0)}")
                        if mismatches:
                            print(f"    Mod {i} MISMATCH: {', '.join(mismatches)}")
                        else:
                            match_count += 1
            
        print(f"\n\nTotal mod matches: {match_count}")
        break
