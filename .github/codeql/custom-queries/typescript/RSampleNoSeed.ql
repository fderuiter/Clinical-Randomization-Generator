/**
 * @name Insecure R sample without seed in template
 * @description Randomization functions in R must be seeded for clinical reproducibility.
 * @kind problem
 * @problem.severity error
 * @id ts/insecure-r-sample-no-seed
 * @tags security
 */

import javascript

from Expr str
where
  (str instanceof StringLiteral and str.(StringLiteral).getValue().regexpMatch("(?is).*\\bsample\\s*\\(.*") and not str.(StringLiteral).getValue().regexpMatch("(?is).*set\\.seed\\s*\\(.*\\bsample\\s*\\(.*")) or
  (str instanceof TemplateElement and str.(TemplateElement).getRawValue().regexpMatch("(?is).*\\bsample\\s*\\(.*") and not str.(TemplateElement).getRawValue().regexpMatch("(?is).*set\\.seed\\s*\\(.*\\bsample\\s*\\(.*"))
select str, "Randomization functions in R must be seeded for clinical reproducibility."
