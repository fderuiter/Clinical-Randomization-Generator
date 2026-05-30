export const R_TEMPLATE = `
# Randomization Schema Configuration
# Protocol: {{protocolId}}
# App Version: 1.0
# Generated At: {{dateStr}}
# Algorithm: {{algorithm}}
set.seed({{seedHash}})
# Arms: {{arms}}
# Ratios: {{ratios}}
{{strataComments}}

# --- SINGLE-SOURCE TRANSPILED LOGIC ---
{{minimizationParam}}
schema_list <- list()
{{schemaRows}}
schema <- do.call(rbind, schema_list)
if (is.null(schema)) schema <- data.frame()
print(head(schema))
`;

export const SAS_TEMPLATE = `
/* Randomization Schema Generation in SAS */
/* Protocol: {{protocolId}} */
/* App Version: 1.0 */
/* Generated At: {{dateStr}} */
/* Algorithm: {{algorithm}} */
%let seed = {{seedHash}};
%let arms = {{arms}};
%let arms_names = {{armsNames}};
%let strata_factors = {{strataFactors}};
/* Ratios: {{ratios}} */
{{strataComments}}

/* --- SINGLE-SOURCE TRANSPILED LOGIC --- */
%let MAX_SITES = 1000; /* SAS site-limit constraint workaround */
{{minimizationParam}}
{{blockSizesParam}}

data RandomizationSchema;
  length SubjectID $20 Site $20 Treatment $50 StratumCode $50 {{strataLength}};
{{schemaRows}}
run;
`;

export const PYTHON_TEMPLATE = `
# Randomization Schema Configuration
# Protocol: {{protocolId}}
# App Version: 1.0
# Generated At: {{dateStr}}
# Algorithm: {{algorithm}}
import numpy as np
import pandas as pd
rng = np.random.default_rng({{seedHash}})
# Arms: {{arms}}
# Ratios: {{ratios}}
{{strataComments}}

# --- SINGLE-SOURCE TRANSPILED LOGIC ---
{{minimizationParam}}
schema = [
{{schemaRows}}
]
df = pd.DataFrame(schema)
print(df.head())
`;

export const STATA_TEMPLATE = `
* Randomization Schema Configuration
* Protocol: {{protocolId}}
* App Version: 1.0
* Generated At: {{dateStr}}
* Algorithm: {{algorithm}}
set seed {{seedHash}}
{{armsVars}}
{{strataComments}}
* Ratios: {{ratios}}

* --- SINGLE-SOURCE TRANSPILED LOGIC ---
local missing_val = . /* Stata missing value constant workaround */
{{minimizationParam}}
{{blockSizesParam}}

clear
set obs {{schemaLength}}
gen str20 SubjectID = ""
gen str20 Site = ""
gen str50 Treatment = ""
gen BlockNumber = .
gen BlockSize = .
gen str50 StratumCode = ""
{{strataLength}}

{{schemaRows}}
`;
