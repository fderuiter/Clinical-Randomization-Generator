/**
 * @name Insecure SAS ranuni
 * @description Do not use the deprecated 'ranuni' function in SAS templates. Use 'call streaminit' and 'rand' instead.
 * @kind problem
 * @problem.severity error
 * @id ts/insecure-sas-ranuni
 * @tags security
 */

import javascript

from Expr str
where
  (str instanceof StringLiteral and str.(StringLiteral).getValue().regexpMatch("(?i).*\\branuni\\b.*")) or
  (str instanceof TemplateElement and str.(TemplateElement).getRawValue().regexpMatch("(?i).*\\branuni\\b.*"))
select str, "Do not use the deprecated 'ranuni' function in SAS templates. Use 'call streaminit' and 'rand' instead."
