"""
Parse Unity Localization SharedTableData and StringTable assets.
Unity's localization package uses specific serialized formats.
Let's examine the raw binary of the shared data to understand the structure.
"""
import UnityPy
import os
import struct

GAME_PATH = r"C:\ledata\Last Epoch_Data\StreamingAssets\aa\StandaloneWindows64"

shared_bundle = os.path.join(GAME_PATH, "localization-assets-shared_assets_all.bundle")
en_bundle = os.path.join(GAME_PATH, "localization-string-tables-english(en)_assets_all.bundle")

# Look at ALL MonoBehaviours in the shared bundle
env = UnityPy.load(shared_bundle)
print("=== Shared bundle ===")
type_counts = {}
for obj in env.objects:
    tn = obj.type.name
    type_counts[tn] = type_counts.get(tn, 0) + 1
print(f"Types: {type_counts}")

all_mbs = []
for obj in env.objects:
    if obj.type.name == 'MonoBehaviour':
        try:
            data = obj.read()
            name = data.m_Name if hasattr(data, 'm_Name') else ''
            raw = obj.get_raw_data()
            all_mbs.append((name, len(raw), obj, raw))
        except:
            pass

all_mbs.sort(key=lambda x: -x[1])
print(f"\nAll {len(all_mbs)} MonoBehaviours:")
for name, sz, obj, raw in all_mbs:
    print(f"  {sz/1024:.1f}KB  {name}")

# Now examine the binary structure of Item_Names Shared Data
print("\n" + "="*60)
print("=== Item_Names Shared Data - Binary Analysis ===")
for name, sz, obj, raw in all_mbs:
    if name == 'Item_Names Shared Data':
        # Show hex dump of first 200 bytes (skip Unity header)
        print(f"Size: {sz} bytes")
        
        # The MonoBehaviour header in Unity serialization:
        # - m_GameObject PPtr (12 bytes), m_Enabled (4 bytes), m_Script PPtr (12 bytes)
        # - m_Name (4 byte length + string + alignment)
        # Then the actual data fields
        
        # Let's find where the actual data starts by looking for the name
        name_bytes = name.encode('utf-8')
        idx = raw.find(name_bytes)
        print(f"Name found at offset {idx}")
        
        # After name + padding, the data begins  
        # Let's look at the structure after the name
        data_start = idx + len(name_bytes)
        # Align to 4 bytes
        data_start = (data_start + 3) & ~3
        
        print(f"\nData after name (offset {data_start}):")
        # Show hex + ascii of next 500 bytes
        for off in range(data_start, min(data_start + 500, len(raw)), 16):
            hex_part = ' '.join(f'{b:02x}' for b in raw[off:off+16])
            ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in raw[off:off+16])
            print(f"  {off:6d}: {hex_part:<48s} {ascii_part}")
        
        # Count how many entries there might be
        # SharedTableData contains entries with: id (long), key (string)
        # Let's look for 8-byte aligned integers that could be entry IDs
        
        # Search for patterns of sequential integers
        print(f"\n--- Looking for key-value structure ---")
        # Unity SharedTableData serializes as:
        # m_TableCollectionName (string)
        # then m_Entries array: count (int), then each entry has:
        #   m_Id (long), m_Key (string), m_Metadata (...)
        
        # Let's try to find the array count
        pos = data_start
        while pos < min(data_start + 200, len(raw) - 4):
            count = struct.unpack_from('<i', raw, pos)[0]
            if 100 < count < 20000:
                print(f"  Possible array count at offset {pos}: {count}")
            pos += 1
        
        break

# Now look at the English string table
print("\n" + "="*60)
print("=== Item_Names_en - Binary Analysis ===")
env2 = UnityPy.load(en_bundle)
for obj in env2.objects:
    if obj.type.name == 'MonoBehaviour':
        data = obj.read()
        name = data.m_Name if hasattr(data, 'm_Name') else ''
        if 'Item_Names' in name and '_en' in name:
            raw = obj.get_raw_data()
            print(f"Name: {name}, Size: {len(raw)} bytes")
            
            name_bytes = name.encode('utf-8')
            idx = raw.find(name_bytes)
            data_start = idx + len(name_bytes)
            data_start = (data_start + 3) & ~3
            
            print(f"\nData after name (offset {data_start}):")
            for off in range(data_start, min(data_start + 500, len(raw)), 16):
                hex_part = ' '.join(f'{b:02x}' for b in raw[off:off+16])
                ascii_part = ''.join(chr(b) if 32 <= b < 127 else '.' for b in raw[off:off+16])
                print(f"  {off:6d}: {hex_part:<48s} {ascii_part}")
            
            # Also look for recognizable strings
            pos = data_start
            print(f"\n--- First few readable strings ---")
            count = 0
            while pos < len(raw) - 4 and count < 30:
                strlen = struct.unpack_from('<i', raw, pos)[0]
                if 2 < strlen < 200:
                    try:
                        s = raw[pos+4:pos+4+strlen].decode('utf-8')
                        if all(c.isprintable() or c in '\n\r\t' for c in s):
                            print(f"  [{pos}] len={strlen}: {s[:100]}")
                            count += 1
                            pos += 4 + strlen
                            pos = (pos + 3) & ~3  # align
                            continue
                    except:
                        pass
                pos += 1
            break
