## 2024-05-16 - Prevent Memory Leaks when Creating Object URLs
**Vulnerability:** Found `URL.createObjectURL(blob)` in `exportCsv()` without a corresponding `URL.revokeObjectURL(url)` call.
**Learning:** Failing to revoke object URLs after triggering a programmatic download creates memory leaks in the browser, as the object URLs remain active until the document is unloaded. This can eventually degrade performance or crash the tab if exports are run frequently.
**Prevention:** Always follow the pattern of wrapping `URL.revokeObjectURL(url)` alongside `document.body.removeChild(link)` inside a `setTimeout()` when programmatic downloads are triggered via object URLs.
