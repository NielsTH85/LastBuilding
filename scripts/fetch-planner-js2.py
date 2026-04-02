import urllib.request, re

# The planner-page JS is small - it likely loads an iframe or dynamically loads the actual app
# Let's read it to find the actual app URL
url = "https://maxroll.gg/assets/planner-page-sE1WUoQC.js"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req, timeout=15)
js = resp.read().decode('utf-8', errors='replace')
print("planner-page JS content:")
print(js[:3000])

print("\n\n---")

# Check the other one too
url2 = "https://maxroll.gg/assets/last-epoch.planner-D5LkDMoJ.js"
req2 = urllib.request.Request(url2, headers={'User-Agent': 'Mozilla/5.0'})
resp2 = urllib.request.urlopen(req2, timeout=15)
js2 = resp2.read().decode('utf-8', errors='replace')
print("last-epoch.planner JS content:")
print(js2[:3000])

# The embed script URL was /leplanner/static/js/embed.js but 404
# Let's try to find the actual leplanner app
# Maybe it's served from a different domain or path
print("\n\n--- Trying leplanner paths ---")
test_urls = [
    "https://maxroll.gg/leplanner/",
    "https://leplanner.maxroll.gg/",
    "https://tools.maxroll.gg/leplanner/",
    "https://maxroll.gg/last-epoch/planner/static/",
]
for u in test_urls:
    try:
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}, method='HEAD')
        resp = urllib.request.urlopen(req, timeout=5)
        print(f"  OK ({resp.status}): {u}")
    except urllib.error.HTTPError as e:
        if e.code != 404:
            print(f"  {e.code}: {u}")
    except Exception as e:
        pass
