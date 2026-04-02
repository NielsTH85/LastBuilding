"""
Save UniqueList raw binary for analysis and build corrected parser.

CORRECTED mod structure (40 bytes, starts just AFTER mod_count):
  +0:  value (float)
  +4:  canRoll (int)
  +8:  type (int: 0=flat, 1=increased, 2=more)
  +12: maxValue (float)
  +16: property (int)
  +20: specialTag (int)
  +24: tags (int bitmask)
  +28: unknown_a (int) 
  +32: unknown_b (int)
  +36: unknown_c (int)

Entry layout:
  - name (string)
  - displayName (string, may be strlen=0)
  - header (152 bytes) with uniqueID at +4, levelRequirement at +56
  - modCount (int)
  - mods (40 bytes each)
  - [post-mod data: descriptions, lore, footer]
"""
import UnityPy
import os
import struct
import json

GAME_PATH = r"C:\ledata\Last Epoch_Data"

with open(r'c:\eob\packages\game-data\src\data\uniques-import.json', 'r') as f:
    maxroll_data = json.load(f)
maxroll_by_id = {item['uniqueID']: item for item in maxroll_data}

def read_string(raw, pos):
    """Read a Unity serialized string."""
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

env = UnityPy.load(os.path.join(GAME_PATH, "resources.assets"))

for obj in env.objects:
    if obj.type.name == 'MonoBehaviour':
        raw = obj.get_raw_data()
        if len(raw) < 28:
            continue
        script_path_id = struct.unpack_from('<q', raw, 20)[0]
        if script_path_id != 9668:
            continue
        
        # Save raw binary for analysis
        with open(r'c:\eob\scripts\uniquelist.bin', 'wb') as f:
            f.write(raw)
        print(f"Saved {len(raw)} bytes to uniquelist.bin")
        
        total_count = struct.unpack_from('<i', raw, 44)[0]
        print(f"Total entries: {total_count}")
        
        pos = 48
        parsed = []
        
        for entry_idx in range(total_count):
            entry_start = pos
            
            # 1. Read internal name
            name, pos = read_string(raw, pos)
            if name is None:
                print(f"ERROR at entry {entry_idx}: can't read name at {entry_start}")
                break
            
            # 2. Read display name
            display_name, pos = read_string(raw, pos)
            if display_name is None:
                display_name = ''
                pos = entry_start + 4  # reset - shouldn't happen
            
            # 3. Read 152-byte header
            if pos + 152 > len(raw):
                print(f"ERROR at entry {entry_idx}: not enough data for header at {pos}")
                break
            
            unique_id = struct.unpack_from('<i', raw, pos + 4)[0]
            level_req = struct.unpack_from('<i', raw, pos + 56)[0]
            pos += 152
            
            # 4. Read mod count
            mod_count = struct.unpack_from('<i', raw, pos)[0]
            pos += 4
            
            if mod_count < 0 or mod_count > 30:
                print(f"ERROR at entry {entry_idx} '{name}': bad mod_count={mod_count} at {pos-4}")
                break
            
            # 5. Read mods with CORRECT format
            mods = []
            for m in range(mod_count):
                if pos + 40 > len(raw):
                    break
                fields = struct.unpack_from('<fiifiiiiii', raw, pos)
                mod = {
                    'value': round(fields[0], 6),
                    'canRoll': bool(fields[1]),
                    'type': fields[2],
                    'maxValue': round(fields[3], 6),
                    'property': fields[4],
                    'specialTag': fields[5],
                    'tags': fields[6],
                    'unknown_a': fields[7],
                    'unknown_b': fields[8],
                    'unknown_c': fields[9],
                }
                mods.append(mod)
                pos += 40
            
            # 6. Read post-mod data (descriptions, lore, footer)
            # Let me try scanning forward for strings
            post_mod_start = pos
            strings_found = []
            scan_pos = pos
            max_scan = min(pos + 2000, len(raw))
            null_count = 0
            
            while scan_pos < max_scan:
                # Try reading an int first
                ival = struct.unpack_from('<i', raw, scan_pos)[0]
                
                # If it looks like a valid string length
                if 1 <= ival <= 5000:
                    s, next_pos = read_string(raw, scan_pos)
                    if s is not None and s.isprintable():
                        strings_found.append((scan_pos - post_mod_start, s))
                        scan_pos = next_pos
                        continue
                
                scan_pos += 4
            
            # Figure out which strings are descriptions, lore, etc.
            # The last "meaningful" string before the next entry is likely lore
            # Find where the next entry starts by looking for a string that matches a known unique name
            next_entry_start = None
            for rel_off, s in strings_found:
                # Check if this string is a known unique name in maxroll
                if s in [item['name'] for item in maxroll_data] or (len(s) > 3 and s[0].isupper() and s.replace(' ','').replace("'",'').replace('-','').isalpha() and len(s) < 40):
                    # This might be the next entry's name
                    # Verify by checking if the data after it matches the pattern
                    check_pos = post_mod_start + rel_off
                    # Check if there's a display name + header pattern following
                    _, np = read_string(raw, check_pos)
                    if np is not None:
                        _, np2 = read_string(raw, np)
                        if np2 is not None and np2 - np <= 204:  # display name is short
                            # Check header uniqueID
                            header_start = np2 if np2 - np > 4 else np
                            if header_start + 8 < len(raw):
                                # Could verify uniqueID is sequential
                                pass
            
            entry = {
                'name': name,
                'displayName': display_name if display_name else name,
                'uniqueID': unique_id,
                'levelRequirement': level_req,
                'mods': mods,
                'post_mod_strings': strings_found,
            }
            parsed.append(entry)
            
            # For now, find next entry by searching for the next unique name
            # Use maxroll name list
            found_next = False
            for rel_off, s in strings_found:
                actual_off = post_mod_start + rel_off
                for item in maxroll_data:
                    if item['name'] == s and item['uniqueID'] > unique_id:
                        pos = actual_off
                        found_next = True
                        break
                if found_next:
                    break
            
            if not found_next:
                # Couldn't find next entry
                break
        
        print(f"\nParsed {len(parsed)} entries\n")
        
        # Cross-reference first 20 entries
        for entry in parsed[:20]:
            uid = entry['uniqueID']
            mx = maxroll_by_id.get(uid)
            
            print(f"\n[{uid}] {entry['name']}" + 
                  (f" / {entry['displayName']}" if entry['displayName'] != entry['name'] else ""))
            print(f"  Level: {entry['levelRequirement']}")
            
            for i, mod in enumerate(entry['mods']):
                print(f"  Mod {i}: prop={mod['property']} val={mod['value']:.4f}-{mod['maxValue']:.4f} "
                      f"type={mod['type']} tags={mod['tags']} special={mod['specialTag']} "
                      f"a={mod['unknown_a']} b={mod['unknown_b']} c={mod['unknown_c']}")
            
            if mx:
                mx_mods = mx.get('mods', [])
                if len(mx_mods) != len(entry['mods']):
                    print(f"  !! MOD COUNT: game={len(entry['mods'])} vs maxroll={len(mx_mods)}")
                for i, (gm, mm) in enumerate(zip(entry['mods'], mx_mods)):
                    mismatches = []
                    if gm['property'] != mm.get('property', -1):
                        mismatches.append(f"prop:{gm['property']}!={mm.get('property')}")
                    if abs(gm['value'] - mm.get('value', 0)) > 0.01:
                        mismatches.append(f"val:{gm['value']:.4f}!={mm.get('value')}")
                    if abs(gm['maxValue'] - mm.get('maxValue', gm['value'])) > 0.01:
                        mismatches.append(f"max:{gm['maxValue']:.4f}!={mm.get('maxValue')}")
                    if gm['tags'] != mm.get('tags', 0):
                        mismatches.append(f"tags:{gm['tags']}!={mm.get('tags')}")
                    if gm['specialTag'] != mm.get('specialTag', 0):
                        mismatches.append(f"sptag:{gm['specialTag']}!={mm.get('specialTag',0)}")
                    if gm['type'] != mm.get('type', 0):
                        mismatches.append(f"type:{gm['type']}!={mm.get('type',0)}")
                    if mismatches:
                        print(f"  !! Mod {i}: {', '.join(mismatches)}")
                    else:
                        print(f"  OK Mod {i} matches")
            
            # Show post-mod strings
            print(f"  Strings after mods: {len(entry['post_mod_strings'])}")
            for off, s in entry['post_mod_strings'][:5]:
                print(f"    [{off}] {s[:80]}")
        
        break
