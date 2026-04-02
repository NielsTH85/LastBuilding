"""Debug entry 471 (index 470) parse failure at pos 304820."""
import struct

with open(r'c:\eob\scripts\uniquelist.bin', 'rb') as f:
    raw = f.read()

pos = 304820
print(f"Debugging at pos {pos}, remaining bytes: {len(raw) - pos}")

# Try reading name
strlen = struct.unpack_from('<i', raw, pos)[0]
print(f"\nFirst int (name length?): {strlen}")
if 0 < strlen < 200:
    name = raw[pos+4:pos+4+strlen].decode('utf-8', errors='replace')
    print(f"Name: '{name}'")
    next_pos = pos + 4 + strlen
    next_pos = (next_pos + 3) & ~3
    pos = next_pos
    
    # displayName
    strlen2 = struct.unpack_from('<i', raw, pos)[0]
    print(f"\nSecond int (dn length?): {strlen2}")
    if 0 <= strlen2 < 200:
        if strlen2 == 0:
            print("Empty display name")
            pos += 4
        else:
            dn = raw[pos+4:pos+4+strlen2].decode('utf-8', errors='replace')
            print(f"DisplayName: '{dn}'")
            next_pos = pos + 4 + strlen2
            next_pos = (next_pos + 3) & ~3
            pos = next_pos
        
        # variantName
        strlen3 = struct.unpack_from('<i', raw, pos)[0]
        print(f"\nThird int (vn length?): {strlen3}")
        if 0 <= strlen3 < 200:
            if strlen3 == 0:
                print("Empty variant name")
                pos += 4
            else:
                vn = raw[pos+4:pos+4+strlen3].decode('utf-8', errors='replace')
                print(f"VariantName: '{vn}'")
                next_pos = pos + 4 + strlen3
                next_pos = (next_pos + 3) & ~3
                pos = next_pos
            
            # Header
            print(f"\nHeader at pos {pos}:")
            for i in range(37):
                val = struct.unpack_from('<i', raw, pos + i*4)[0]
                fval = struct.unpack_from('<f', raw, pos + i*4)[0]
                if val != 0:
                    print(f"  [{i}] int={val}  float={fval:.6f}")
            
            uid = struct.unpack_from('<i', raw, pos)[0]
            print(f"\n  uid={uid}")
            pos += 148
            
            # Mod count
            mc = struct.unpack_from('<i', raw, pos)[0]
            print(f"  mod_count={mc}")
            pos += 4
            
            if 0 <= mc <= 30:
                for m in range(mc):
                    fields = struct.unpack_from('<fiifiiiiii', raw, pos)
                    print(f"  mod[{m}]: val={fields[0]:.4f} canRoll={fields[1]} maxVal={fields[3]:.4f} "
                          f"prop={fields[4]} special={fields[5]} tags={fields[6]} type={fields[8]} hide={fields[9]}")
                    pos += 40
                
                # Desc count
                dc = struct.unpack_from('<i', raw, pos)[0]
                print(f"\n  desc_count={dc}")
                pos += 4
    else:
        print(f"Bad displayName length: {strlen2}")
        # Show raw bytes
        for i in range(20):
            p = pos + i * 4
            if p + 4 <= len(raw):
                val = struct.unpack_from('<i', raw, p)[0]
                fval = struct.unpack_from('<f', raw, p)[0]
                print(f"  [{i}] pos {p}: int={val} float={fval:.6f} hex={raw[p:p+4].hex()}")
else:
    print(f"Bad name length: {strlen}")
    for i in range(20):
        p = pos + i * 4
        if p + 4 <= len(raw):
            val = struct.unpack_from('<i', raw, p)[0]
            print(f"  [{i}] pos {p}: int={val} hex={raw[p:p+4].hex()}")
