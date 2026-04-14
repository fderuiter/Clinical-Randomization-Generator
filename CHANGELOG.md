# [1.24.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.23.0...v1.24.0) (2026-04-14)


### Bug Fixes

* address code review issues - newline, label rename, probability clarity ([8127bee](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/8127bee844fcff8eccea7bf605b5d7673f4addc5))
* apply all PR review feedback for minimization algorithm ([80d61b9](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/80d61b9030d719790b247bd7ec63febf65ac6c93))
* apply second round of PR review feedback for minimization ([1a82a9d](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/1a82a9d831f0c828d5626b4dd1515e5d85c48845))
* correct indentation in minimization-algorithm.ts ([bbe83bf](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/bbe83bf92bae7aa1b91d6bc67b7f0a15d9fae5c4))


### Features

* implement Pocock-Simon minimization (covariate-adaptive randomization) ([6ff8ebf](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/6ff8ebfe75278bb275cb77ab1d3396baca823aab))

# [1.23.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.22.0...v1.23.0) (2026-04-10)


### Bug Fixes

* correct typo in buildStratificationNarrative method name ([6653de3](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/6653de3593076337b63c5fdb140001ba0c4cce3b))


### Features

* add MethodologySpecificationService and integrate into exports and code generators ([42a950c](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/42a950cc1b64c5e82545069f643c9a283f5b4681))

# [1.22.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.21.0...v1.22.0) (2026-04-10)


### Bug Fixes

* align all Angular packages to consistent patch versions to resolve npm ci ERESOLVE failure ([e6a2c11](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/e6a2c11408ca01f57bccd9692ef4088ce66a5e61))
* use takeUntilDestroyed for SW subscription cleanup and align service-worker package version ([d57cf2a](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/d57cf2a0ac2cc90a56d8f70c1502b4d6225123b9))


### Features

* implement PWA architecture with service worker, manifest, and update notification ([ee6be4c](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/ee6be4cd86c76108a290d08cefc85181ea5d6f19))

# [1.21.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.20.0...v1.21.0) (2026-04-10)


### Bug Fixes

* add angularTemplateInliner Vite plugin to vitest.config.ts to resolve templateUrl at test time ([29fb093](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/29fb093c86ff4c88dd0b1ff587e337a15ddd085c))
* add provideRouter([]) to schema-verification spec to fix ActivatedRoute DI error ([8c5a642](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/8c5a6424cf1ce916f01bf5a8d30a4a10e95741ab))
* address code review feedback on exportJson - blinding, memory leak, filename sanitization, spy cleanup ([1ce28f7](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/1ce28f742d68b2a9a460a472b1bb4f0b6e93c336))
* apply PR review feedback - toast alerts, blob cleanup, disabled JSON button, dynamic year, sitemap, vitest query string fix ([49174fb](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/49174fbf76dcb5149bcf8975abc50d79a604e943))
* correct JSON export test expectation to use _blinded suffix for default state ([bae2507](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/bae25079ce953e27cc09b4046915b79d3220bdb7))
* gate JSON export behind isUnblinded, update verification copy and tests ([7f6383a](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/7f6383a94481e0df8ae68a6d841516e02407094d))
* use download icon for JSON export button ([24c7d27](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/24c7d27888d150fc5696462b15eedd53f109839d))
* use exact text match in navigation e2e test to avoid strict mode multi-element failure ([c280b81](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/c280b814157efe58cb3512b6ac4481e17f697fb3))


### Features

* add JSON export for schema reproducibility verification ([3383740](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/3383740b4230a35c76caebb7f65e8807d69d604f))
* rebrand to Equipose and add comprehensive SEO enhancements ([ccec012](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/ccec01286fd2dc3f3d785f55849234af309d406c))

# [1.20.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.19.0...v1.20.0) (2026-04-10)


### Features

* implement hierarchical block strategy engine with UI and code gen support ([f3f278e](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/f3f278e0a196eaeccfe845865eba589a373afa66))

# [1.19.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.18.0...v1.19.0) (2026-04-10)


### Bug Fixes

* add missing capStrategy/globalCap/levelDetails to store spec, fix NG8107 optional chain in generator template ([6fee554](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/6fee554186b99db79f8cb0fa37d127c527a65212))
* address code review - use .get() consistently in Python pruning, add null safety for empty levels in SAS ([846941a](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/846941afd620856807e0d060b4cb5e5ac332b950))
* address code review - use Map for marginal caps (prevents prototype pollution), implement MANUAL_MATRIX switch on computed cap edit ([ac0f4c3](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/ac0f4c332b8f78f158d18da4516ba5f5ae3d9238))
* apply all review feedback — canComputeMatrix guard, matrixComputed on globalCap, undefined marginalCap, blockNumber tracking, non-termination guards, test data fix, optional FormValue fields ([1012dab](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/1012dab3ea0db04ff50d8bc6e0596ebac85e1d0a))
* apply second round of review feedback — stronger MARGINAL_ONLY guard, undefined marginalCap in form, min=0 for caps, BlockNumber in generated code ([4ebf58e](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/4ebf58eb5bd91309ea8d195eae89bceb3a15f815))
* clarify computeProportionalCaps JSDoc preconditions, fix Sites→Strata factors label, enforce integer>=0 in parseMarginalCapInput ([8d56fc8](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/8d56fc8366722d43ee5c0311ecbb6d7888d5bdfb))
* preserve undefined marginalCaps in syncLevelDetails, use Number.isFinite in termination guard, align Validators.min(0) with HTML min="0" ([60647a6](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/60647a64f6685a54c40954bb436bd62bb77ad642))
* review 4084891193 — ARIA radiogroup, label for/id, globalCap validators, validateMarginalOnly guard, NaN validation, name-based levelDetails lookup + ARCHITECTURE.md update ([ebcd4a4](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/ebcd4a4c99d57906ec2973aa3fcd463a34bddc93))
* use explicit SAS assignment for block_num increment; improve cap-strategy bounds comment ([2a6ae99](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/2a6ae99cc98c637a003de638340eb83e3993df82))
* use Math.floor for integer seat distribution and add comment explaining matrixComputed guard ([6d58848](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/6d588484403b7a8dea897664a5c3850ab1e38ab4))


### Features

* add PROPORTIONAL and MARGINAL_ONLY support to R, Python, and SAS code generators ([903dae7](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/903dae7d3770bab0b525b5db8b22a80c9a7b0a7a))
* implement Advanced Stratum Cap Logic (Proportional/Dynamic) ([b2790ca](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/b2790ca23f412d02e7568946be2a9f08070febc2))

# [1.18.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.17.0...v1.18.0) (2026-04-09)


### Bug Fixes

* update generator spec selectors to avoid false match on BlockPreview legend ([7fa5fd5](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/7fa5fd57b885572eb5b6d870e046b01d79a0e9c6))


### Features

* implement BlockPreviewComponent for visual block allocation preview ([192c93f](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/192c93f7d28ecaf392cd90ca0a68127275bd60be))

# [1.17.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.16.0...v1.17.0) (2026-04-09)


### Bug Fixes

* restore missing copyAuditHash JSDoc comment removed during refactor ([9d3293e](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/9d3293eb8f42c93de8041a6e053ca37618589e58))


### Features

* implement high-performance virtual scroll grid with multi-column filtering and sorting ([bcd5df9](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/bcd5df9a9e9c5def8f55d627b56431d1ab086181)), closes [hi#performance](https://github.com/hi/issues/performance)

# [1.16.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.15.0...v1.16.0) (2026-04-09)


### Features

* add SchemaVerificationComponent for reproducibility QA ([a1cce52](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/a1cce52854656c0bc4cdd992b5b8ec3687f02ddd))

# [1.15.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.14.0...v1.15.0) (2026-04-09)


### Bug Fixes

* address code review feedback on crypto hash and clipboard handling ([ed75e6b](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/ed75e6ba6d8d78a8f5cae63d4ef9fa0cfbd4e71a))
* replace vi.mock relative import with crypto.subtle spy; guard exportPdf spy in test ([a1624d5](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/a1624d59d2cc7257b1af9c4be6d92949c090b3b1))


### Features

* add cryptographic audit hash and certificate of generation ([7675222](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/7675222f541bfa5cf2c45aab74d8375930f30405))

# [1.14.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.13.0...v1.14.0) (2026-04-09)


### Bug Fixes

* align Advanced Settings accordion with mobile/responsive patterns ([059739d](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/059739da8dbd9575a761398fddd3cd451cece9d9)), closes [#97](https://github.com/fderuiter/Clinical-Randomization-Generator/issues/97)
* **e2e:** expand Advanced Settings accordion before filling seed in code-generator test ([56dd010](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/56dd010de77c12109aeae5213196ec0654f73429)), closes [#seed](https://github.com/fderuiter/Clinical-Randomization-Generator/issues/seed)


### Features

* progressive disclosure accordion with CDK tooltips for advanced settings ([25b0297](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/25b0297a306b73ad6093c2b4480bf473167a3892)), closes [hi#contrast](https://github.com/hi/issues/contrast)

# [1.13.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.12.0...v1.13.0) (2026-04-09)


### Bug Fixes

* add group class and hover styles to grouped-view sticky column ([add648e](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/add648e7d6452618d96207703580e608f07c7fa0))
* address code review issues - add group class, fix touch targets, use focus-visible ([61b07b0](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/61b07b0911a15be8e338b61eeec9d43c29969a6f))


### Features

* implement responsive architecture with CDK viewport service and mobile adaptations ([2e3faef](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/2e3faefc6a695458a5fb80d00221fc12b306ae66))

# [1.12.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.11.0...v1.12.0) (2026-04-09)


### Features

* add Balance Verification tab with statistical aggregation engine ([f6b9fbe](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/f6b9fbe38a9f9e1d2ec16aebcb9e54d10dcba566))

# [1.11.0](https://github.com/fderuiter/Clinical-Randomization-Generator/compare/v1.10.0...v1.11.0) (2026-04-09)


### Bug Fixes

* address code review findings - remove unused import, guard null row in action methods ([1ba86bc](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/1ba86bca4545e920bcf50c3ca0596fde2fce70fb))
* **e2e:** add stable data-testid attributes and update E2E selectors for arm cell ([b342829](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/b3428299569bb18bec662c6be8f9e4676cf5a27e))


### Features

* add Toast system, kebab menu, and remove static error banner ([a5e6cab](https://github.com/fderuiter/Clinical-Randomization-Generator/commit/a5e6cab50ed3cce96e5b487c40fbddcc9b382c89))

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
