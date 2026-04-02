"""
Parse UniqueList from resources.assets with known field layout.
Mod structure (40 bytes = 10 x int32):
  +0:  specialTag (int)
  +4:  hideInTooltip (int/bool)
  +8:  unknown (int)
  +12: value (float)
  +16: canRoll (int/bool)
  +20: type (int: 0=flat, 1=increased%, 2=more%)
  +24: maxValue (float)
  +28: property (int)
  +32: unknown2 (int)
  +36: tags (int bitmask)
"""
import UnityPy
import os
import struct
import json

GAME_PATH = r"C:\ledata\Last Epoch_Data"
env = UnityPy.load(os.path.join(GAME_PATH, "resources.assets"))

# Load maxroll data for comparison
with open(r'c:\eob\packages\game-data\src\data\uniques-import.json', 'r') as f:
    maxroll_data = json.load(f)

maxroll_by_name = {}
for item in maxroll_data:
    maxroll_by_name[item['name']] = item

def read_string(raw, pos):
    """Read a Unity serialized string at position. Returns (string, next_pos)."""
    if pos + 4 > len(raw):
        return None, pos
    strlen = struct.unpack_from('<i', raw, pos)[0]
    if strlen < 0 or strlen > 10000:
        return None, pos
    if pos + 4 + strlen > len(raw):
        return None, pos
    try:
        s = raw[pos+4:pos+4+strlen].decode('utf-8')
    except:
        return None, pos
    next_pos = pos + 4 + strlen
    next_pos = (next_pos + 3) & ~3  # align to 4 bytes
    return s, next_pos

def read_mod(raw, pos):
    """Read a 40-byte mod structure."""
    if pos + 40 > len(raw):
        return None, pos
    fields = struct.unpack_from('<iiifiiifii', raw, pos)
    return {
        'specialTag': fields[0],
        'hideInTooltip': bool(fields[1]),
        'unknown1': fields[2],
        'value': round(fields[3], 8),
        'canRoll': bool(fields[4]),
        'type': fields[5],
        'maxValue': round(fields[6], 8),
        'property': fields[7],
        'unknown2': fields[8],
        'tags': fields[9],
    }, pos + 40

# Find UniqueList
for obj in env.objects:
    if obj.type.name == 'MonoBehaviour':
        raw = obj.get_raw_data()
        if len(raw) >= 28:
            script_path_id = struct.unpack_from('<q', raw, 20)[0]
            if script_path_id == 9668:  # UniqueList
                total_count = struct.unpack_from('<i', raw, 44)[0]
                print(f"UniqueList: {len(raw)} bytes, {total_count} entries")
                
                # For understanding the full structure, let me trace through the first 5 entries
                # and find the repeating pattern
                pos = 48  # Start after array count
                
                for entry_idx in range(min(10, total_count)):
                    entry_start = pos
                    
                    # Read name
                    name, pos = read_string(raw, pos)
                    if name is None:
                        print(f"  Entry {entry_idx}: Failed to read name at {entry_start}")
                        break
                    
                    # After name, there's a fixed-size block before mods
                    # Let me scan for the mod count by looking at the structure
                    # For Calamity, mod count (3) was at offset 216 (168 bytes after name end at 60)
                    # But this offset might vary per entry due to variable-length fields
                    
                    # Let me try to find mod count by scanning for it
                    # I know after name there are ~148 bytes of header, then mod count
                    # Let me read the fixed header (try different sizes)
                    
                    # Actually let me try reading the binary as: 
                    # [name] [displayName?] [68 bytes of zeros] [some header data] [mod_count] [mods]
                    
                    # For now let me dump the next 200 bytes to understand
                    print(f"\n  === Entry {entry_idx}: '{name}' at {entry_start} ===")
                    
                    # Look ahead for readable strings and non-zero values
                    scan_start = pos
                    
                    # Read all non-zero 4-byte values for next 300 bytes
                    values = []
                    for off in range(pos, min(pos + 300, len(raw) - 4), 4):
                        ival = struct.unpack_from('<i', raw, off)[0]
                        fval = struct.unpack_from('<f', raw, off)[0]
                        if ival != 0:
                            is_float = (0.0001 < abs(fval) < 100000 and fval == fval and abs(fval) < 10000)
                            values.append((off, ival, fval if is_float else None))
                    
                    # Show them
                    for off, ival, fval in values[:30]:
                        if fval is not None:
                            print(f"    [{off:5d}] int={ival:10d}  float={fval:.6f}")
                        else:
                            print(f"    [{off:5d}] int={ival:10d}")
                    
                    # Cross-reference with maxroll
                    if name in maxroll_by_name:
                        mx = maxroll_by_name[name]
                        print(f"    Maxroll: id={mx.get('uniqueID')}, base={mx.get('baseType')}, "
                              f"sub={mx.get('subTypes')}, level={mx.get('levelRequirement')}, "
                              f"mods={len(mx.get('mods', []))}")
                    else:
                        print(f"    (not in maxroll)")
                    
                    # Try to find the mod count: look for an integer that equals the expected mod count
                    # and is followed by valid mod data
                    if name in maxroll_by_name:
                        expected_mods = len(maxroll_by_name[name].get('mods', []))
                    else:
                        expected_mods = None
                    
                    # Search for mod count
                    found_mods_at = None
                    for off, ival, fval in values:
                        if expected_mods is not None and ival == expected_mods and off > scan_start + 100:
                            # Check if this is followed by valid mod data
                            mod_start = off + 4
                            test_mod, _ = read_mod(raw, mod_start)
                            if test_mod and test_mod['tags'] > 0 and abs(test_mod['value']) < 1000:
                                found_mods_at = off
                                print(f"    *** Mod count={ival} found at offset {off} ***")
                                print(f"    *** First mod: {test_mod} ***")
                                break
                    
                    if found_mods_at is None and expected_mods is not None:
                        # Try looking for expected mod count at fixed offset from name
                        # For Calamity: name ends at 60, mod count at 216, offset=156
                        test_offset = pos + 156
                        if test_offset + 4 < len(raw):
                            ival = struct.unpack_from('<i', raw, test_offset)[0]
                            if ival == expected_mods:
                                found_mods_at = test_offset
                                print(f"    *** Mod count={ival} found at fixed offset {test_offset} ***")
                    
                    # Skip to approximate next entry
                    # For now, scan forward for the next plausible name string
                    scan_pos = pos + 100
                    next_entry_pos = None
                    while scan_pos < min(pos + 2000, len(raw) - 4):
                        s, npos = read_string(raw, scan_pos)
                        if s is not None and 3 <= len(s) <= 50 and s[0].isupper() and not s.startswith('[') and not s.startswith('(') and s.replace(' ', '').replace("'", '').replace('-','').isalpha():
                            # Check if this could be a unique name
                            if s in maxroll_by_name:
                                next_entry_pos = scan_pos
                                print(f"    -> Next entry '{s}' found at {scan_pos}")
                                break
                        scan_pos += 1
                    
                    if next_entry_pos is None:
                        # Look further  
                        scan_pos = pos + 2000
                        while scan_pos < min(pos + 5000, len(raw) - 4):
                            s, npos = read_string(raw, scan_pos)
                            if s is not None and s in maxroll_by_name:
                                next_entry_pos = scan_pos
                                print(f"    -> Next entry '{s}' found at {scan_pos}")
                                break
                            scan_pos += 1
                    
                    if next_entry_pos is not None:
                        entry_size = next_entry_pos - entry_start
                        print(f"    -> Entry total size: {entry_size} bytes")
                        pos = next_entry_pos
                    else:
                        print(f"    -> Could not find next entry")
                        break
                
                break
