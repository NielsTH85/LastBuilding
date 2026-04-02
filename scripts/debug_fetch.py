import urllib.request, gzip, io, json

url = 'https://maxroll.gg/last-epoch/planner/data.json'
req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://maxroll.gg/last-epoch/planner',
})
resp = urllib.request.urlopen(req, timeout=30)
raw = resp.read()
ct = resp.headers.get('Content-Type')
ce = resp.headers.get('Content-Encoding')
print(f'Size: {len(raw)} bytes, Content-Type: {ct}, Content-Encoding: {ce}')
print(f'First 50 bytes (hex): {raw[:50].hex()}')
print(f'First 50 bytes (repr): {repr(raw[:50])}')

# Try gzip decode
if raw[:2] == b'\x1f\x8b':
    print('Detected gzip')
    raw = gzip.decompress(raw)
    print(f'Decompressed: {len(raw)} bytes')

# Try brotli
try:
    import brotli
    raw = brotli.decompress(raw)
    print(f'Brotli decompressed: {len(raw)} bytes')
except:
    pass

text = raw.decode('utf-8', errors='replace')
print(f'Text first 300 chars: {text[:300]}')
