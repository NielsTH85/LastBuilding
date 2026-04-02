"""
Deep parse UniqueList from resources.assets binary data.
Try to reverse-engineer the binary layout of unique item definitions.
"""
import UnityPy
import os
import struct
import re

GAME_PATH = r"C:\ledata\Last Epoch_Data"
env = UnityPy.load(os.path.join(GAME_PATH, "resources.assets"))

# Find UniqueList MonoBehaviour
for obj in env.objects:
    if obj.type.name == 'MonoBehaviour':
        raw = obj.get_raw_data()
        if len(raw) >= 28:
            script_path_id = struct.unpack_from('<q', raw, 20)[0]
            if script_path_id == 9668:  # UniqueList
                print(f"=== UniqueList: {len(raw)} bytes ===")
                
                # Dump more of the data to understand structure
                # Name is "UniqueList" at offset 32, length 10
                # After name, data starts
                
                # Let's look at the full beginning
                print("\n--- Header ---")
                for off in range(0, 200, 16):
                    hex_part = ' '.join(f'{b:02x}' for b in raw[off:off+16])
                    ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in raw[off:off+16])
                    print(f"  {off:6d}: {hex_part:<48s} {ascii_part}")
                
                # After "UniqueList\0\0" at offset 32-43, next is data at offset 44
                # At offset 44: d7 01 00 00 = 471 (decimal) - this could be the array count!
                count = struct.unpack_from('<i', raw, 44)[0]
                print(f"\nPossible entry count at offset 44: {count}")
                
                # At offset 48: "Calamity" (8 chars)
                # So the first entry starts at offset 48 with a string
                
                # Let's try to parse entries
                pos = 48
                entries = []
                for i in range(min(10, count)):
                    if pos >= len(raw) - 4:
                        break
                    
                    # Read string (name)
                    strlen = struct.unpack_from('<i', raw, pos)[0]
                    if strlen < 0 or strlen > 200:
                        print(f"  Entry {i}: bad strlen={strlen} at pos={pos}")
                        break
                    name = raw[pos+4:pos+4+strlen].decode('utf-8', errors='replace')
                    pos += 4 + strlen
                    pos = (pos + 3) & ~3  # align
                    
                    # Read the rest of the entry fields
                    # Let's dump the next 200 bytes to understand the structure
                    print(f"\n  --- Entry {i}: '{name}' ---")
                    remaining = min(300, len(raw) - pos)
                    
                    # Show as hex
                    for off in range(pos, pos + remaining, 16):
                        hex_part = ' '.join(f'{b:02x}' for b in raw[off:off+16])
                        ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in raw[off:off+16])
                        print(f"  {off:6d}: {hex_part:<48s} {ascii_part}")
                    
                    # Look for the next string to find entry boundary
                    # Search for the next entry name
                    next_str_pos = pos
                    while next_str_pos < len(raw) - 4:
                        maybe_len = struct.unpack_from('<i', raw, next_str_pos)[0]
                        if 3 < maybe_len < 100:
                            try:
                                s = raw[next_str_pos+4:next_str_pos+4+maybe_len].decode('utf-8')
                                if s.isprintable() and not s.startswith('\x00'):
                                    # Check if it looks like a unique name
                                    if any(c.isupper() for c in s[:3]) and ' ' not in s[:2]:
                                        # Could be next entry name
                                        entry_size = next_str_pos - pos
                                        if entry_size > 20:
                                            entries.append({'name': name, 'size': entry_size})
                                            print(f"\n  -> Entry size: {entry_size} bytes")
                                            print(f"  -> Next entry: '{s}'")
                                            pos = next_str_pos
                                            break
                            except:
                                pass
                        next_str_pos += 1
                    else:
                        break
                
                # Show found entry sizes
                print(f"\n--- Entry summary ---")
                for e in entries:
                    print(f"  {e['name']}: {e['size']} bytes")
                
                break
