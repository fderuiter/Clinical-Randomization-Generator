1. **Identify the vulnerability:**
   The `exportCsv` function in `src/app/domain/schema-management/components/results-grid.component.ts` dynamically creates an anchor link and clicks it to download a file. The cleanup of the created object URL and anchor element is happening synchronously. However, it should be wrapped in a `setTimeout` to ensure the browser has enough time to initiate the download and prevent potential issues with memory or failed downloads, especially for larger files or on slower browsers. This aligns with a known memory in `.jules/sentinel.md` (or general knowledge for this app) about using `setTimeout` for `URL.revokeObjectURL(url)`.

   Wait, the `exportCsv` function DOES NOT EVEN CALL `URL.revokeObjectURL(url)`. It creates an object URL and never revokes it, leading to a memory leak.
   `exportJson` does:
   ```typescript
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
   ```
   `exportCsv` just does:
   ```typescript
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
   ```

2. **Implement the fix:**
   I will update `exportCsv` in `src/app/domain/schema-management/components/results-grid.component.ts` to include `setTimeout` for both `document.body.removeChild(link)` and `URL.revokeObjectURL(url)`, bringing it in line with the other export methods and fixing the memory leak.

3. **Verify the change:**
   Run `pnpm format`, `pnpm lint`, and `pnpm test`.

4. **Complete pre-commit steps:**
   Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

5. **Commit and create PR:**
   Title: "🛡️ Sentinel: [MEDIUM] Fix memory leak in CSV download"
