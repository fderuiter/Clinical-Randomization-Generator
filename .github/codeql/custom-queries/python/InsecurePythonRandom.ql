/**
 * @name Insecure Python random
 * @description Use np.random.default_rng(seed) instead of standard random library for clinical scripts.
 * @kind problem
 * @problem.severity error
 * @id py/insecure-python-random
 * @tags security
 */

import python

from Call call, Attribute attr
where
  call.getFunc() = attr and
  (
    (
      attr.getObject().(Name).getId() = "random" and
      attr.getName() in ["random", "randint", "choice"]
    )
    or
    (
      attr.getObject().(Attribute).getObject().(Name).getId() = "np" and
      attr.getObject().(Attribute).getName() = "random" and
      attr.getName() = "rand"
    )
  ) and
  not call.getLocation().getFile().getAbsolutePath().regexpMatch("(?i).*verify_python_schema\\.py")
select call, "Use np.random.default_rng(seed) instead of standard random library for clinical scripts."
