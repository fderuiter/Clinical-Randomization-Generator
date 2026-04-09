# [1.10.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.9.0...v1.10.0) (2026-04-09)


### Bug Fixes

* correct hasRnd expression and remove dead else-if branch in subject-id-engine ([f4b2bbb](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/f4b2bbb2848ee07618ed0e8c852f8a0d0b8b2f88))
* **e2e:** harden Complex preset Monte Carlo test against CI timeout ([5dca61c](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/5dca61c92a1e87ce9bfe2040bce4a6dd526e1b70))


### Features

* implement Subject ID generation enhancements with new token engine ([8367969](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/8367969aa94915cd8eaf99c37bb7852025a016b3))

# [1.9.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.8.0...v1.9.0) (2026-04-09)


### Features

* typographic system redesign for data-dense environments ([871f6f7](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/871f6f7c21381788980256472b00ced602b63d2f))

# [1.8.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.7.0...v1.8.0) (2026-04-09)


### Features

* add Group by Block view mode to ResultsGridComponent ([9ab0388](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/9ab038885a9c97f650cae144b37256cc483518b3))

# [1.7.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.6.0...v1.7.0) (2026-04-08)


### Bug Fixes

* add stable data-testid attributes to Monte Carlo modal and fix strict-mode locator collisions in Playwright tests ([07e1fea](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/07e1feade74d0ab3719dda942febe4743a37d1a7))
* resolve merge conflict with main (v1.6.0 Schema Analytics Dashboard) and remove stray conflict marker ([285cb18](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/285cb18afe88a2235d0ee0fcfebe3a5a1d1e8bcb))


### Features

* add Monte Carlo statistical validation feature ([0cd9e96](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/0cd9e9605b37154798f310d97b5b2b275b5f1a71))
* Monte Carlo Statistical Validation Report Generator ([b05ccc8](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/b05ccc80abfb501717e0979449fbd25ece3ce847))

# [1.6.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.5.1...v1.6.0) (2026-04-08)


### Bug Fixes

* use US English spelling in comments (Centralized, Initialize) ([f40037b](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/f40037bc7bd44c1a7a4807904b0af195eaac3811))


### Features

* add Schema Analytics Dashboard with Apache ECharts and cross-filtering ([f1b8a29](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/f1b8a29ffc4643d0aa313f6230b54e3f15fcec89))

## [1.5.1](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.5.0...v1.5.1) (2026-04-08)


### Bug Fixes

* address code review - remove unused param, add named constant for auto-seed range ([ea187a9](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/ea187a96a2bac974fe65c51dab476b236bbdd680))
* allow empty seed in code generator; auto-generate seed when not provided ([4970f8d](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/4970f8dfa154fcb76139cad79afb3a4a18c87256))

# [1.5.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.4.0...v1.5.0) (2026-04-08)


### Bug Fixes

* **e2e:** add data-testid to generated code pre element and update E2E selectors with timeouts ([bc6638e](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/bc6638e7dd9b1913c252610ff67ab1b54b964433))
* **e2e:** fill seed field before opening code generator modal to avoid MissingSeedError ([09d2162](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/09d216253aa13e084b070c94feaf9db8ebaa9c76))


### Features

* implement granular error hierarchy and structured error UI for code generation ([ed83edd](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/ed83eddb66079ac3c5a5f54138dd5c3077424128))

# [1.4.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.3.0...v1.4.0) (2026-04-08)


### Bug Fixes

* remove redundant tabular-nums class where font-mono is applied ([0a82353](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/0a82353aebc120c657d88690ae3aa8ad58aa6057))


### Features

* implement design system, dark mode, and ThemeService ([0864900](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/086490037f5abbbf5dd9d619faba6670102cb9e3))

# [1.3.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.2.0...v1.3.0) (2026-04-08)


### Bug Fixes

* **e2e:** fix flaky tests - direct navigation and explicit waits ([0c60603](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/0c60603942b49242216531a084e8c5de03187ecb))
* **e2e:** scope stratum levels locator to app-tag-input input to avoid non-fillable host match ([8264e99](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/8264e999891bf03db0b47887451573deff2766ad))
* **e2e:** update selectors and interactions for new visual builder UI ([e75583c](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/e75583cfb41518a130eb41457a08307810f2493f))


### Features

* interactive visual builder UI with tag inputs, arm cards, and drag-and-drop strata ([2f97dd6](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/2f97dd6c5b04a96b553a7e16443a26332fe4ca3a))

# [1.2.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.1.0...v1.2.0) (2026-04-08)


### Features

* Architectural refactor - DDD structure, Facade, SignalStore, Web Worker, ESLint boundaries ([00387a0](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/00387a0edbc168f1817d84559d76adbde530dac7))
* phases 5-7 — parity tests, legacy decommission, build verification ([7c76626](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/7c7662622754707206547af6b1fc5a478e202093)), closes [hi#volume](https://github.com/hi/issues/volume)

# [1.1.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.0.0...v1.1.0) (2026-04-02)


### Features

* add draft schema watermark to csv and pdf exports ([#17](https://github.com/fderuiter/Clinical-Randomization-Generator/issues/17)) ([fde3439](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/fde34393610477a74999a70ba1db30f888c64b80))

# 1.0.0 (2026-04-02)


### Bug Fixes

* github pages blank screen and remove old name ([4784a99](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/4784a99c8fd658bb7e6b75bfa68f6d1007ebee55))
* resolve dependency conflict in package.json ([e3e69c0](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/e3e69c08c21fb102c05427843b303462b5377e4f))
* revert playwright test port to 4200 for CI compatibility ([b01432e](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/b01432ee5ab65958182c30ca91b1f0617b9a1dcf))
* Upgrade Python Code Generator ([#6](https://github.com/fderuiter/Clinical-Randomization-Generator/issues/6)) ([e19e3a6](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/e19e3a67e0e7b873b2f0bb2a3a93b98361a9fe2a))


### Features

* add audit trails and semantic-release versioning ([96a1066](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/96a10663263b717d89c7884429cebfd73d5375b2))
* Configure AI Studio app for local development ([68be745](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/68be745706b88c25b67d890ba19d7fc71f278aff))
* Set up application routing and landing page ([90b9638](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/90b963824fcee714c7eaddd7585805585dd66b0a))
