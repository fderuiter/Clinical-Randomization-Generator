## 2025-02-24 - Avoid window.alert() for Error Handling
**Vulnerability:** The application used native `window.alert()` calls to catch and display unhandled errors during schema code generation and Monte Carlo simulations. This acts as a thread-blocking UI disruption and is heavily flagged by modern security/SAST linters as a vulnerability or code smell (often related to XSS payload verification).
**Learning:** Even though `alert()` may seem like a quick patch for error propagation, it degrades user experience and introduces linting vulnerabilities. The codebase already implements a more secure, non-blocking notification layer via `ToastService`.
**Prevention:** Always rely on `ToastService` to render error messages rather than native browser dialogs.
