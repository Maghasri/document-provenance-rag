import time, statistics
from verify import verify_document

H = "0x991d9d2400484234ddaa85de3cb4d4e732d0df5997ac6849055e2a0b0fff8124"
times = []
for _ in range(20):
    t = time.perf_counter()
    r = verify_document(H)
    times.append((time.perf_counter() - t) * 1000)
    assert r["valid"]
times.sort()
print(f"mean={statistics.mean(times):.0f} ms  median={statistics.median(times):.0f} ms  p95={times[18]:.0f} ms")
