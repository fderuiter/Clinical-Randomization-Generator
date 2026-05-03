## 2025-05-03 - [Refactoring minimization algorithm]
**Learning:** Pre-computing the cartesian product into an array of objects ({ profile: {}, key: string }) instead of calculating keys dynamically per element in arrays of flat objects within the inner hot-loop, reduces runtime significantly from 19s to 2.7s for totalSampleSize 5000.
**Action:** Always precalculate invariant keys for filtering and sampling arrays during heavy algorithms instead of computing them on every loop.
