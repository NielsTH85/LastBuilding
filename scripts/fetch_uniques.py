"""
Fetch unique items data from maxroll's data.json and extract the uniques array.
"""
import urllib.request, json, os

url = "https://planners.maxroll.gg/last-epoch/data.json"
print(f"Fetching {url}...")

req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
})

try:
    resp = urllib.request.urlopen(req, timeout=30)
    raw = resp.read()
    print(f"Downloaded {len(raw)} bytes")
    
    data = json.loads(raw)
    print(f"Top-level keys: {list(data.keys())}")
    
    # Save the full data for reference
    with open('maxroll-data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))
    print(f"Saved full data to maxroll-data.json")
    
    # Check uniques
    if 'uniques' in data:
        uniques = data['uniques']
        print(f"\nFound {len(uniques)} unique items")
        
        # Show first 3 uniques with their structure
        for u in uniques[:3]:
            print(f"\nUnique #{u.get('uniqueID', '?')}: {u.get('name', '?')} (displayName: {u.get('displayName', 'N/A')})")
            print(f"  baseType: {u.get('baseType')}, subTypes: {u.get('subTypes')}")
            print(f"  levelRequirement: {u.get('levelRequirement')}")
            print(f"  isSetItem: {u.get('isSetItem', False)}")
            print(f"  legendaryType: {u.get('legendaryType', 'N/A')}")
            mods = u.get('mods', [])
            print(f"  mods ({len(mods)}):")
            for m in mods[:5]:
                print(f"    {m}")
    else:
        print("No 'uniques' key found!")
        
except Exception as e:
    print(f"Error: {e}")
    # Try alternative URL
    alt_url = "https://planners.maxroll.gg/data.json"
    print(f"\nTrying {alt_url}...")
    req2 = urllib.request.Request(alt_url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    })
    try:
        resp2 = urllib.request.urlopen(req2, timeout=30)
        raw2 = resp2.read()
        print(f"Downloaded {len(raw2)} bytes")
        data2 = json.loads(raw2)
        print(f"Top-level keys: {list(data2.keys())}")
    except Exception as e2:
        print(f"Also failed: {e2}")
