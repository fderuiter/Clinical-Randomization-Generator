#!/usr/bin/env python3
"""
Cross-Environment Equivalence Fixture – Python

This script implements the same stratified block randomization algorithm used
by the Equipose TypeScript engine, translated to native Python using numpy's
PCG64 PRNG (np.random.default_rng).

Purpose
-------
Validates that the *structural properties* of the schema (total subjects per
stratum, block internal balance, arm allocation ratios) are correct when the
algorithm is executed natively in Python.

Note: Because Python's PCG64 PRNG differs from the TypeScript Alea/MersenneTwister
implementation, the exact treatment sequence will not match. What IS verified:
  - Total subject count equals the expected value (sum of stratum caps × sites)
  - Every complete block maintains strict internal balance
  - Overall allocation ratio converges to the configured target
  - No stratum cap is exceeded

Regulatory reference: ICH E9 §2.3 — Statistical Principles for Clinical Trials.

Exit code 0 = all assertions passed.
Exit code 1 = one or more assertions failed.
"""

import sys
import itertools
import numpy as np

# ---------------------------------------------------------------------------
# Configuration (mirrors the Vitest fixture STRATIFIED_CONFIG)
# ---------------------------------------------------------------------------

PROTOCOL_ID  = "XENV-PYTHON-001"
STUDY_NAME   = "Cross-Env Equivalence Study"
SEED         = 20240101   # integer seed for np.random.default_rng

sites        = ["Site-Alpha", "Site-Beta"]
arms         = [{"name": "Drug", "id": "D", "ratio": 1},
                {"name": "Placebo", "id": "P", "ratio": 1}]
block_sizes  = [4]
strata       = [{"id": "sex",  "levels": ["M", "F"]},
                {"id": "age",  "levels": ["<65", ">=65"]}]

# Intersection caps: 20 subjects per (sex × age) combination per site
stratum_caps = {
    ("M",  "<65"):  20,
    ("M",  ">=65"): 20,
    ("F",  "<65"):  20,
    ("F",  ">=65"): 20,
}

# ---------------------------------------------------------------------------
# Derived constants
# ---------------------------------------------------------------------------

total_ratio       = sum(a["ratio"] for a in arms)
strata_names      = [s["id"] for s in strata]
strata_levels_lst = [s["levels"] for s in strata]
combos            = list(itertools.product(*strata_levels_lst))

EXPECTED_PER_STRATUM_SITE = 20
EXPECTED_TOTAL = len(sites) * len(combos) * EXPECTED_PER_STRATUM_SITE

# ---------------------------------------------------------------------------
# Block-generation helper (Fisher-Yates shuffle via numpy)
# ---------------------------------------------------------------------------

def generate_block(block_size: int, rng: np.random.Generator) -> list[str]:
    multiplier = block_size // total_ratio
    block = []
    for arm in arms:
        block.extend([arm["name"]] * int(arm["ratio"] * multiplier))
    rng.shuffle(block)
    return block

# ---------------------------------------------------------------------------
# Schema generation (MANUAL_MATRIX / intersection caps)
# ---------------------------------------------------------------------------

def generate_schema(seed: int) -> list[dict]:
    rng = np.random.default_rng(seed)
    schema: list[dict] = []

    for site in sites:
        site_subject_count = 0
        for combo in combos:
            cap = stratum_caps.get(combo, 0)
            stratum = dict(zip(strata_names, combo))

            stratum_subject_count = 0
            block_number = 1

            while stratum_subject_count < cap:
                bs = int(rng.choice(block_sizes))
                block = generate_block(bs, rng)

                for treatment in block:
                    site_subject_count += 1
                    stratum_subject_count += 1

                    schema.append({
                        "SubjectID":   f"{site}-{site_subject_count:03d}",
                        "Site":        site,
                        "BlockNumber": block_number,
                        "BlockSize":   bs,
                        "Treatment":   treatment,
                        **stratum,
                    })

                    if stratum_subject_count >= cap:
                        break

                block_number += 1

    return schema

# ---------------------------------------------------------------------------
# Assertions
# ---------------------------------------------------------------------------

def assert_structural_properties(schema: list[dict]) -> list[str]:
    failures: list[str] = []

    # 1. Total subject count
    if len(schema) != EXPECTED_TOTAL:
        failures.append(
            f"Total subjects: expected {EXPECTED_TOTAL}, got {len(schema)}"
        )

    # 2. Arm names in output
    observed_arms = {row["Treatment"] for row in schema}
    expected_arms = {a["name"] for a in arms}
    if observed_arms != expected_arms:
        failures.append(
            f"Arms in schema: expected {expected_arms}, got {observed_arms}"
        )

    # 3. Sites in output
    observed_sites = {row["Site"] for row in schema}
    if observed_sites != set(sites):
        failures.append(
            f"Sites in schema: expected {set(sites)}, got {observed_sites}"
        )

    # 4. Block internal balance: every complete block must have
    #    exactly (block_size / total_ratio) assignments per arm.
    blocks: dict[tuple, list[str]] = {}
    for row in schema:
        key = (row["Site"], row.get("sex", ""), row.get("age", ""), row["BlockNumber"])
        if key not in blocks:
            blocks[key] = []
        blocks[key].append(row["Treatment"])

    for key, treatments in blocks.items():
        bs = len(treatments)
        if bs != block_sizes[0]:
            # Partial last block — skip balance check
            continue
        for arm in arms:
            expected_count = bs // total_ratio
            actual_count = treatments.count(arm["name"])
            if actual_count != expected_count:
                failures.append(
                    f"Block {key}: arm '{arm['name']}' count {actual_count} "
                    f"!= expected {expected_count}"
                )

    # 5. Stratum cap enforcement
    site_stratum_counts: dict[tuple, int] = {}
    for row in schema:
        k = (row["Site"], row.get("sex", ""), row.get("age", ""))
        site_stratum_counts[k] = site_stratum_counts.get(k, 0) + 1

    for k, count in site_stratum_counts.items():
        if count > EXPECTED_PER_STRATUM_SITE:
            failures.append(
                f"Stratum cap exceeded: {k} has {count} > {EXPECTED_PER_STRATUM_SITE}"
            )

    # 6. Overall allocation ratio check (1:1 → ~50% per arm)
    arm_counts = {a["name"]: 0 for a in arms}
    for row in schema:
        arm_counts[row["Treatment"]] = arm_counts.get(row["Treatment"], 0) + 1

    grand_total = sum(arm_counts.values())
    for arm in arms:
        expected_frac = arm["ratio"] / total_ratio
        observed_frac = arm_counts[arm["name"]] / grand_total
        deviation = abs(observed_frac - expected_frac)
        if deviation > 0.01:  # 1 pp tolerance for a deterministic run
            failures.append(
                f"Arm '{arm['name']}' allocation deviation {deviation:.4%} "
                f"exceeds 1% tolerance (expected {expected_frac:.2%}, "
                f"got {observed_frac:.2%})"
            )

    return failures

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    print(f"Cross-Environment Equivalence Check (Python)")
    print(f"  Protocol: {PROTOCOL_ID}")
    print(f"  Seed:     {SEED}")
    print(f"  Expected subjects: {EXPECTED_TOTAL}")

    schema = generate_schema(SEED)
    failures = assert_structural_properties(schema)

    if failures:
        print("\nFAILURES:")
        for msg in failures:
            print(f"  ✗ {msg}")
        print(f"\nCROSS_ENV_CHECK: FAIL ({len(failures)} assertion(s) failed)")
        return 1

    # Print a short summary for CI logs
    arm_counts = {a["name"]: 0 for a in arms}
    for row in schema:
        arm_counts[row["Treatment"]] += 1

    print(f"\n  Total subjects generated: {len(schema)}")
    for name, count in arm_counts.items():
        pct = count / len(schema) * 100
        print(f"  {name}: {count} ({pct:.1f}%)")

    print(f"\nCROSS_ENV_CHECK: PASS — all {len(schema)} subjects verified")
    return 0


if __name__ == "__main__":
    sys.exit(main())
