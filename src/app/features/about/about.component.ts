import {Component} from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  template: `
    <div class="bg-white dark:bg-slate-900 py-24 sm:py-32">
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <div class="mx-auto max-w-2xl lg:mx-0">
          <h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-slate-100 sm:text-4xl">About Equipose</h2>
          <p class="mt-6 text-lg leading-8 text-gray-600 dark:text-slate-400">
            Equipose is a free, open-source tool designed to help biostatisticians, clinical trial managers, and contract
            research organisations (CROs) rapidly design, simulate, and export stratified block randomization schemas for
            clinical trials. It runs entirely in your browser - no server, no sign-up, no data ever transmitted externally.
          </p>

          <!-- Compliance notice -->
          <div class="mt-8 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 rounded-r-md">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-yellow-400 dark:text-yellow-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-yellow-700 dark:text-yellow-300">
                  <strong>Important Notice:</strong> This tool utilizes a zero trust architecture and is <strong>not 21 CFR Part 11 compliant</strong>. For 21 CFR Part 11 compliance, users must maintain a record of their generated code for the study instead of using the sample generated schema. The generated schema provided by this application is <strong>not to be used in production for any study</strong>, despite its validity, due to the zero trust infrastructure of the program.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Feature cards -->
        <div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            <div class="flex flex-col">
              <dt class="text-base font-semibold leading-7 text-gray-900 dark:text-slate-100">
                <div class="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 dark:bg-indigo-500 shadow-sm">
                  <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                Custom Ratios
              </dt>
              <dd class="mt-1 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-slate-400">
                <p class="flex-auto">Define custom ratios for treatment arms, allowing for complex trial designs such as 2:1 or 3:1:1 randomization schemas.</p>
              </dd>
            </div>
            <div class="flex flex-col">
              <dt class="text-base font-semibold leading-7 text-gray-900 dark:text-slate-100">
                <div class="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 dark:bg-indigo-500 shadow-sm">
                  <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                Stratified Block Randomization
              </dt>
              <dd class="mt-1 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-slate-400">
                <p class="flex-auto">Ensure balance across multiple sites and stratification factors using a seeded Fisher-Yates shuffle algorithm.</p>
              </dd>
            </div>
            <div class="flex flex-col">
              <dt class="text-base font-semibold leading-7 text-gray-900 dark:text-slate-100">
                <div class="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 dark:bg-indigo-500 shadow-sm">
                  <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                </div>
                Code Generation
              </dt>
              <dd class="mt-1 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-slate-400">
                <p class="flex-auto">Export your randomization schema logic to R, SAS, or Python scripts for validation and integration into your statistical analysis plan.</p>
              </dd>
            </div>
          </dl>
        </div>

        <!-- What is stratified block randomization -->
        <div class="mx-auto mt-20 max-w-2xl lg:mx-0">
          <h3 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">What is Stratified Block Randomization?</h3>
          <p class="mt-4 text-base leading-7 text-gray-600 dark:text-slate-400">
            Stratified block randomization is a statistical method used in clinical trial design to ensure that treatment
            groups are balanced across key prognostic factors - such as clinical site, age group, disease severity, or
            region. By first stratifying subjects into homogeneous subgroups (strata) and then applying block randomization
            within each stratum, the method guarantees that each treatment arm receives a proportional share of subjects
            with similar baseline characteristics. This improves the statistical power of the trial and reduces the risk
            of confounding.
          </p>
          <p class="mt-4 text-base leading-7 text-gray-600 dark:text-slate-400">
            Variable block sizes are recommended to prevent investigators from predicting upcoming allocations, thereby
            protecting allocation concealment and maintaining the integrity of the blind.
          </p>
        </div>

        <!-- Who it is for -->
        <div class="mx-auto mt-16 max-w-2xl lg:mx-0">
          <h3 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">Who Is Equipose For?</h3>
          <ul class="mt-4 space-y-3 text-base leading-7 text-gray-600 dark:text-slate-400 list-disc list-inside">
            <li><strong class="text-gray-800 dark:text-slate-300">Biostatisticians</strong> designing randomization schemas and drafting Statistical Analysis Plans (SAPs).</li>
            <li><strong class="text-gray-800 dark:text-slate-300">Clinical Trial Managers</strong> who need a quick, reproducible simulation of allocation sequences.</li>
            <li><strong class="text-gray-800 dark:text-slate-300">Contract Research Organisations (CROs)</strong> validating randomization logic before implementation in IRT/IVRS systems.</li>
            <li><strong class="text-gray-800 dark:text-slate-300">Academic researchers</strong> running investigator-initiated trials with limited budget for specialised software.</li>
          </ul>
        </div>

        <!-- Zero trust privacy -->
        <div class="mx-auto mt-16 max-w-2xl lg:mx-0">
          <h3 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-slate-100">Zero-Trust Privacy</h3>
          <p class="mt-4 text-base leading-7 text-gray-600 dark:text-slate-400">
            Equipose is built on a zero-trust architecture. Every computation - from randomization to code generation -
            runs entirely inside your browser using WebAssembly-class JavaScript. No protocol identifiers, study names,
            treatment arm labels, or randomization outputs are ever sent to any server. There are no cookies, no analytics
            trackers, and no accounts. Your trial design data stays on your machine.
          </p>
        </div>
      </div>
    </div>
  `
})
export class AboutComponent {}
