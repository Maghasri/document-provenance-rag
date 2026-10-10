import time, statistics, hashlib, requests
from verify import verify_document

H = "0x991d9d2400484234ddaa85de3cb4d4e732d0df5997ac6849055e2a0b0fff8124"

r = verify_document(H)
cid = r["cid"]

fetch = []
for _ in range(10):
    t = time.perf_counter()
    data = requests.get(f"https://gateway.pinata.cloud/ipfs/{cid}", timeout=60).content
    fetch.append((time.perf_counter() - t) * 1000)

t = time.perf_counter()
hashlib.sha256(data).hexdigest()
sha = (time.perf_counter() - t) * 1000

print(f"IPFS fetch: mean={statistics.mean(fetch):.0f} ms  min={min(fetch):.0f}  max={max(fetch):.0f}")
print(f"SHA-256: {sha:.3f} ms")
