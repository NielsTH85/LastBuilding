"""
Map known Calamity data to binary to decode the UniqueList format.
Known from maxroll:
  - uniqueID: 0
  - name: "Calamity" 
  - baseType: 0
  - subTypes: [1]
  - 3 mods with properties 1, 0, 3 and specific float values
  - loreText: "Set the world ablaze and burn along with it."
"""
import UnityPy
import os
import struct
import re

GAME_PATH = r"C:\ledata\Last Epoch_Data"
env = UnityPy.load(os.path.join(GAME_PATH, "resources.assets"))

for obj in env.objects:
    if obj.type.name == 'MonoBehaviour':
        raw = obj.get_raw_data()
        if len(raw) >= 28:
            script_path_id = struct.unpack_from('<q', raw, 20)[0]
            if script_path_id == 9668:  # UniqueList
                # Array count at offset 44: 471
                total_count = struct.unpack_from('<i', raw, 44)[0]
                print(f"Total entries: {total_count}")
                
                # Dump ALL strings and their positions in the first ~3000 bytes
                print(f"\n=== All strings in first 2000 bytes ===")
                pos = 48  # Start after array count
                while pos < min(2000, len(raw) - 4):
                    strlen = struct.unpack_from('<i', raw, pos)[0]
                    if 1 <= strlen <= 500 and pos + 4 + strlen <= len(raw):
                        try:
                            s = raw[pos+4:pos+4+strlen].decode('utf-8')
                            if all(c.isprintable() or c in '\n\r\t' for c in s) and s.strip():
                                print(f"  [{pos:4d}] strlen={strlen}: '{s[:100]}'")
                                
                                # Show bytes between this string and previous
                                next_pos = pos + 4 + strlen
                                next_pos = (next_pos + 3) & ~3  # align
                                
                                # Skip past aligned string
                                pos = next_pos
                                continue
                        except:
                            pass
                    pos += 4
                
                # Now try to interpret floats around known values
                print(f"\n=== Float analysis (known Calamity mod values) ===")
                # Mod 1: value=1.0, maxValue=1.5
                # Mod 2: value=0.2, maxValue=0.8  
                # Mod 3: value=0.05, maxValue=0.1
                known_floats = {
                    struct.pack('<f', 1.0): '1.0',
                    struct.pack('<f', 1.5): '1.5',
                    struct.pack('<f', 0.2): '0.2',
                    struct.pack('<f', 0.8): '0.8',
                    struct.pack('<f', 0.05): '0.05',
                    struct.pack('<f', 0.1): '0.1',
                    struct.pack('<f', 0.5): '0.5',
                }
                
                for off in range(48, 600, 4):
                    if off + 4 <= len(raw):
                        chunk = raw[off:off+4]
                        if chunk in known_floats:
                            ival = struct.unpack_from('<i', raw, off)[0]
                            print(f"  [{off:4d}] float={known_floats[chunk]}, int={ival}")
                
                # Show all non-zero int32s in Calamity's data range
                print(f"\n=== Non-zero int32s in offset 58-580 ===")
                for off in range(56, 580, 4):
                    ival = struct.unpack_from('<i', raw, off)[0]
                    fval = struct.unpack_from('<f', raw, off)[0]
                    if ival != 0:
                        # Is it a plausible float?
                        is_float = (0.001 < abs(fval) < 100000 and fval == fval)  # not NaN
                        if is_float:
                            print(f"  [{off:4d}] int={ival:10d}  float={fval:.6f}")
                        else:
                            print(f"  [{off:4d}] int={ival:10d}")
                
                # Also try to find the boundary structure
                # Look for the second unique item entry
                # We know the lore text is "Set the world ablaze..."
                lore_text = b"Set the world ablaze"
                lore_pos = raw.find(lore_text)
                if lore_pos >= 0:
                    # The lore string starts 4 bytes after its length
                    lore_len_pos = lore_pos - 4
                    print(f"\n  Lore text found at offset {lore_pos} (length at {lore_len_pos})")
                    lore_strlen = struct.unpack_from('<i', raw, lore_len_pos)[0]
                    print(f"  Lore string length: {lore_strlen}")
                    lore = raw[lore_pos:lore_pos+lore_strlen].decode('utf-8', errors='replace')
                    print(f"  Lore: '{lore}'")
                    
                    # After lore, what comes next?
                    after_lore = lore_pos + lore_strlen
                    after_lore = (after_lore + 3) & ~3
                    print(f"\n  Data after lore (offset {after_lore}):")
                    for off in range(after_lore, min(after_lore + 200, len(raw)), 4):
                        ival = struct.unpack_from('<i', raw, off)[0]
                        fval = struct.unpack_from('<f', raw, off)[0]
                        is_float = (0.001 < abs(fval) < 100000) and fval == fval
                        if is_float and ival != 0:
                            print(f"    [{off:4d}] int={ival:10d}  float={fval:.6f}")
                        else:
                            print(f"    [{off:4d}] int={ival:10d}")
                
                break
