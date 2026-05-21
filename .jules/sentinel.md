## 2025-05-18 - Missing Object URL Revocation in File Downloads
**Vulnerability:** Memory leak from unrevoked `URL.createObjectURL(blob)` calls.
**Learning:** Programmatic file downloads require manual garbage collection of the object URL. Synchronous removal of the link element may also interrupt the download in some browsers.
**Prevention:** Always use `setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);` when implementing programmatic downloads.
