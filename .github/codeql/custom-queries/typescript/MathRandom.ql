/**
 * @name Strict ban on Math.random
 * @description Use seedrandom or the Web Crypto API (crypto.getRandomValues) instead of Math.random().
 * @kind problem
 * @problem.severity error
 * @id ts/strict-insecure-math-random
 * @tags security
 */

import javascript

from CallExpr call
where
  call.getCallee().(PropAccess).getBase().(Identifier).getName() = "Math" and
  call.getCallee().(PropAccess).getPropertyName() = "random" and
  not call.getFile().getAbsolutePath().regexpMatch("(?i).*\\.spec\\.ts") and
  not call.getFile().getAbsolutePath().regexpMatch("(?i).*tests_e2e.*")
select call, "Use seedrandom or the Web Crypto API (crypto.getRandomValues) instead of Math.random()."
