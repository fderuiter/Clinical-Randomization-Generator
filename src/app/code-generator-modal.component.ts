import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { RandomizationConfig } from './randomization.service';

@Component({
  selector: 'app-code-generator-modal',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" (click)="closeModal.emit()"></div>
        <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl w-full">
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="sm:flex sm:items-start">
              <div class="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <div class="flex justify-between items-center mb-4">
                  <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    Code Generator
                  </h3>
                  <div class="flex gap-2">
                    <button (click)="downloadCode()" class="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                    <button (click)="copyCode()" class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {{ copied() ? 'Copied!' : 'Copy Code' }}
                    </button>
                  </div>
                </div>
                
                <div class="border-b border-gray-200 mb-4">
                  <nav class="-mb-px flex space-x-8" aria-label="Tabs">
                    <button (click)="activeTab.set('R')" [class.border-indigo-500]="activeTab() === 'R'" [class.text-indigo-600]="activeTab() === 'R'" [class.border-transparent]="activeTab() !== 'R'" [class.text-gray-500]="activeTab() !== 'R'" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm hover:text-gray-700 hover:border-gray-300">
                      R
                    </button>
                    <button (click)="activeTab.set('SAS')" [class.border-indigo-500]="activeTab() === 'SAS'" [class.text-indigo-600]="activeTab() === 'SAS'" [class.border-transparent]="activeTab() !== 'SAS'" [class.text-gray-500]="activeTab() !== 'SAS'" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm hover:text-gray-700 hover:border-gray-300">
                      SAS
                    </button>
                    <button (click)="activeTab.set('Python')" [class.border-indigo-500]="activeTab() === 'Python'" [class.text-indigo-600]="activeTab() === 'Python'" [class.border-transparent]="activeTab() !== 'Python'" [class.text-gray-500]="activeTab() !== 'Python'" class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm hover:text-gray-700 hover:border-gray-300">
                      Python
                    </button>
                  </nav>
                </div>

                <div class="bg-gray-900 rounded-md p-4 overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <pre class="text-gray-100 text-sm font-mono"><code>{{ currentCode }}</code></pre>
                </div>
              </div>
            </div>
          </div>
          <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button type="button" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm" (click)="closeModal.emit()">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CodeGeneratorModalComponent {
  @Input({required: true}) config!: RandomizationConfig;
  @Input() set initialTab(val: 'R' | 'SAS' | 'Python') {
    if (val) {
      this.activeTab.set(val);
    }
  }
  @Output() closeModal = new EventEmitter<void>();

  activeTab = signal<'R' | 'SAS' | 'Python'>('R');
  copied = signal(false);

  get currentCode() {
    if (!this.config) return '';
    try {
      switch (this.activeTab()) {
        case 'R': return this.rCode;
        case 'SAS': return this.sasCode;
        case 'Python': return this.pythonCode;
        default: return '';
      }
    } catch (e) {
      console.error('Error generating code:', e);
      return 'Error generating code. Please check your configuration.';
    }
  }

  copyCode() {
    navigator.clipboard.writeText(this.currentCode);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  downloadCode() {
    const code = this.currentCode;
    const extension = this.activeTab() === 'R' ? 'R' : this.activeTab() === 'SAS' ? 'sas' : 'py';
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `randomization_code.${extension}`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }

  hashCode(str: string | undefined): number {
    if (!str) return 12345;
    const s = String(str);
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  get rCode() {
    const sites = this.config.sites || [];
    const blockSizes = this.config.blockSizes || [];
    const arms = this.config.arms || [];
    const strata = this.config.strata || [];

    return `# Randomization Schema Generation in R
# Protocol: ${this.config.protocolId || 'Unknown'}
# Study: ${this.config.studyName || 'Unknown'}
# Generated by Clinical Randomization Generator

# Set seed for reproducibility
# Note: R uses a different PRNG than the web tool, so the exact sequence will differ,
# but the statistical properties and parameters remain the same.
set.seed(${this.hashCode(this.config.seed)})

# Parameters
sites <- c(${sites.map(s => '"' + s + '"').join(', ')})
block_sizes <- c(${blockSizes.join(', ')})
subjects_per_site <- ${this.config.subjectsPerSite || 0}

# Treatment Arms
arms <- c(${arms.map(a => '"' + a.name + '"').join(', ')})
ratios <- c(${arms.map(a => a.ratio).join(', ')})
total_ratio <- sum(ratios)

# Strata
${strata.map(s => `${s.id}_levels <- c(${(s.levels || []).map(l => '"' + l + '"').join(', ')})`).join('\n')}

# Generate all strata combinations
strata_grid <- expand.grid(
  ${strata.map(s => `${s.id} = ${s.id}_levels`).join(',\n  ')}
)

# Function to generate a single block
generate_block <- function(block_size) {
  multiplier <- block_size / total_ratio
  block <- rep(arms, times = ratios * multiplier)
  sample(block) # Shuffle
}

# Generate Schema
schema <- data.frame()

for (site in sites) {
  for (i in 1:nrow(strata_grid)) {
    stratum <- strata_grid[i, , drop=FALSE]
    
    subject_count <- 0
    block_number <- 1
    
    while (subject_count < subjects_per_site) {
      # Pick random block size
      current_block_size <- sample(block_sizes, 1)
      
      # Generate block
      current_block <- generate_block(current_block_size)
      
      for (treatment in current_block) {
        subject_count <- subject_count + 1
        
        # Format Subject ID (Simplified)
        subject_id <- sprintf("%s-%03d", site, subject_count)
        
        row <- data.frame(
          SubjectID = subject_id,
          Site = site,
          BlockNumber = block_number,
          BlockSize = current_block_size,
          Treatment = treatment
        )
        row <- cbind(row, stratum)
        
        schema <- rbind(schema, row)
        
        if (subject_count >= subjects_per_site) break
      }
      if (subject_count >= subjects_per_site) break
      block_number <- block_number + 1
    }
  }
}

print(head(schema))
# write.csv(schema, "randomization_schema.csv", row.names=FALSE)
`;
  }

  get pythonCode() {
    const sites = this.config.sites || [];
    const blockSizes = this.config.blockSizes || [];
    const arms = this.config.arms || [];
    const strata = this.config.strata || [];

    return `# Randomization Schema Generation in Python
# Protocol: ${this.config.protocolId || 'Unknown'}
# Study: ${this.config.studyName || 'Unknown'}

import random
import itertools
import pandas as pd

# Set seed for reproducibility
random.seed("${this.config.seed || '12345'}")

# Parameters
sites = [${sites.map(s => '"' + s + '"').join(', ')}]
block_sizes = [${blockSizes.join(', ')}]
subjects_per_site = ${this.config.subjectsPerSite || 0}

# Treatment Arms
arms = [${arms.map(a => `{"name": "${a.name}", "ratio": ${a.ratio}}`).join(', ')}]
total_ratio = sum(arm["ratio"] for arm in arms)

# Strata
strata_levels = [
    ${strata.map(s => `[${(s.levels || []).map(l => '"' + l + '"').join(', ')}]`).join(',\n    ')}
]
strata_names = [${strata.map(s => '"' + s.id + '"').join(', ')}]

# Generate all strata combinations
strata_combinations = list(itertools.product(*strata_levels))

schema = []

for site in sites:
    for combo in strata_combinations:
        stratum = dict(zip(strata_names, combo))
        
        subject_count = 0
        block_number = 1
        
        while subject_count < subjects_per_site:
            # Pick random block size
            current_block_size = random.choice(block_sizes)
            
            # Generate block
            multiplier = current_block_size // total_ratio
            block = []
            for arm in arms:
                block.extend([arm["name"]] * int(arm["ratio"] * multiplier))
            
            random.shuffle(block)
            
            for treatment in block:
                subject_count += 1
                
                # Format Subject ID (Simplified)
                subject_id = f"{site}-{subject_count:03d}"
                
                row = {
                    "SubjectID": subject_id,
                    "Site": site,
                    "BlockNumber": block_number,
                    "BlockSize": current_block_size,
                    "Treatment": treatment
                }
                row.update(stratum)
                schema.append(row)
                
                if subject_count >= subjects_per_site:
                    break
            
            block_number += 1

df = pd.DataFrame(schema)
print(df.head())
# df.to_csv("randomization_schema.csv", index=False)
`;
  }

  get sasCode() {
    const sites = this.config.sites || [];
    const blockSizes = this.config.blockSizes || [];
    const arms = this.config.arms || [];
    const strata = this.config.strata || [];
    const totalRatio = arms.reduce((sum, a) => sum + a.ratio, 0);

    let code = `/* Randomization Schema Generation in SAS */
/* Protocol: ${this.config.protocolId || 'Unknown'} */
/* Study: ${this.config.studyName || 'Unknown'} */

%let seed = ${this.hashCode(this.config.seed)};
%let subjects_per_site = ${this.config.subjectsPerSite || 0};
%let total_ratio = ${totalRatio};

/* User-defined Parameters */
%let arms = ${arms.map(a => `"${a.name}"`).join(' ')};
%let ratios = ${arms.map(a => a.ratio).join(' ')};
%let block_sizes = ${blockSizes.join(' ')};
%let sites = ${sites.map(s => `"${s}"`).join(' ')};
`;

    if (strata.length > 0) {
      code += `%let strata_factors = ${strata.map(s => `"${s.id}"`).join(' ')};\n`;
      for (const s of strata) {
        code += `%let ${s.id}_levels = ${(s.levels || []).map(l => `"${l}"`).join(' ')};\n`;
      }
    }

    code += `
/* 1. Build the Design Matrix (Sites and Strata) */
data _sites;
  length Site $50;
  _n_sites = countw(&sites., ' ', 'q');
  do _i = 1 to _n_sites;
    Site = dequote(scan(&sites., _i, ' ', 'q'));
    output;
  end;
  drop _i _n_sites;
run;
`;

    let designVars = ['Site'];
    if (strata.length > 0) {
      for (let i = 0; i < strata.length; i++) {
        const s = strata[i];
        designVars.push(s.id);
        code += `
data _strata_${i+1};
  length ${s.id} $50;
  _n_levels = countw(&${s.id}_levels., ' ', 'q');
  do _i = 1 to _n_levels;
    ${s.id} = dequote(scan(&${s.id}_levels., _i, ' ', 'q'));
    output;
  end;
  drop _i _n_levels;
run;
`;
      }

      code += `
proc sql noprint;
  create table _design as
  select a.Site`;
      for (let i = 0; i < strata.length; i++) {
        const char = String.fromCharCode(98 + i); // 'b', 'c', etc.
        code += `, ${char}.${strata[i].id}`;
      }
      code += `
  from _sites a`;
      for (let i = 0; i < strata.length; i++) {
        const char = String.fromCharCode(98 + i);
        code += `
  cross join _strata_${i+1} ${char}`;
      }
      code += `;\nquit;\n`;
    } else {
      code += `
proc sql noprint;
  create table _design as
  select a.Site
  from _sites a;
quit;
`;
    }

    code += `
/* 2. Generate Blocks and Assign Treatments */
data _blocks;
  set _design;
  call streaminit(&seed.);
  length Treatment $50;

  _total_ratio = &total_ratio.;
  _subj_count = 0;
  block_num = 1;

  do while (_subj_count < &subjects_per_site.);
    /* Dynamic Block Selection */
    _rand_val = rand('uniform');
`;

    for (let i = 0; i < blockSizes.length; i++) {
      if (i === 0 && blockSizes.length === 1) {
        code += `    block_size = ${blockSizes[i]};\n`;
      } else if (i === 0) {
        const p = (i + 1) / blockSizes.length;
        code += `    if _rand_val <= ${p.toFixed(5)} then block_size = ${blockSizes[i]};\n`;
      } else if (i === blockSizes.length - 1) {
        code += `    else block_size = ${blockSizes[i]};\n`;
      } else {
        const p = (i + 1) / blockSizes.length;
        code += `    else if _rand_val <= ${p.toFixed(5)} then block_size = ${blockSizes[i]};\n`;
      }
    }

    code += `
    _subj_count = _subj_count + block_size;
    _multiplier = block_size / _total_ratio;
    _n_arms = countw(&arms., ' ', 'q');

    /* Generate Treatments for the Block */
    do _a = 1 to _n_arms;
      Treatment = dequote(scan(&arms., _a, ' ', 'q'));
      _arm_ratio = input(scan(&ratios., _a, ' '), best.);

      do _t = 1 to round(_arm_ratio * _multiplier);
        _rand_sort = rand('uniform');
        output;
      end;
    end;
    block_num = block_num + 1;
  end;
run;
`;

    code += `
/* 3. Enforce Physical Sorting to Permute Blocks */
`;
    const byVars = designVars.join(' ');
    code += `proc sort data=_blocks;
  by ${byVars} block_num _rand_sort;
run;
`;

    const lastDesignVar = designVars[designVars.length - 1];

    code += `
/* 4. Final Data Deliverable & Cleanup */
data final_schema;
  set _blocks;
  by ${byVars};
  retain _seq;
  if first.${lastDesignVar} then _seq = 1;
  else _seq = _seq + 1;

  if _seq <= &subjects_per_site.;

  /* Format Subject ID */
  length SubjectID $50;
  SubjectID = cats(Site, "-", put(_seq, z3.));

  drop _:;
run;
`;

    code += `
/* 5. Quality Control (QC) Checks */
proc freq data=final_schema;
  title "Overall Treatment Balance";
  tables Treatment / nocum;
run;

proc freq data=final_schema;
  title "Site-Level Treatment Balance";
  tables Site * Treatment / nocol nopercent;
run;

proc freq data=final_schema;
  title "Block Size Distribution";
  tables block_size / nocum;
run;

title "Randomization Schema Preview";
proc print data=final_schema(obs=20);
run;
title;
`;

    return code.trim() + '\n';
  }
}
