#!/usr/bin/env Rscript
#
# Cross-Environment Equivalence Fixture – R
#
# This script implements the same stratified block randomization algorithm used
# by the Equipose TypeScript engine, translated to native R using base R's
# Mersenne-Twister PRNG (set.seed).
#
# Purpose
# -------
# Validates that the *structural properties* of the schema (total subjects per
# stratum, block internal balance, arm allocation ratios) are correct when the
# algorithm is executed natively in R.
#
# Note: R's Mersenne-Twister PRNG will not produce the same sequence as the
# TypeScript Alea/seedrandom implementation even with the same numeric seed.
# What IS verified:
#   - Total subject count equals the expected value
#   - Every complete block maintains strict internal balance
#   - Overall allocation ratio converges to the configured target
#   - No stratum cap is exceeded
#
# Regulatory reference: ICH E9 §2.3 — Statistical Principles for Clinical Trials.
#
# Exit code 0 = all assertions passed.
# Exit code 1 = one or more assertions failed.

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROTOCOL_ID <- "XENV-R-001"
STUDY_NAME  <- "Cross-Env Equivalence Study (R)"
SEED        <- 20240101L

sites       <- c("Site-Alpha", "Site-Beta")
arms        <- list(
  list(name = "Drug",    id = "D", ratio = 1),
  list(name = "Placebo", id = "P", ratio = 1)
)
block_sizes <- c(4L)
strata      <- list(
  list(id = "sex", levels = c("M", "F")),
  list(id = "age", levels = c("<65", ">=65"))
)

# Intersection caps: 20 subjects per (sex × age) combination per site
cap_matrix <- list(
  "M|<65"   = 20L,
  "M|>=65"  = 20L,
  "F|<65"   = 20L,
  "F|>=65"  = 20L
)

# ---------------------------------------------------------------------------
# Derived constants
# ---------------------------------------------------------------------------

total_ratio <- sum(sapply(arms, function(a) a$ratio))
arm_names   <- sapply(arms, function(a) a$name)

strata_levels <- lapply(strata, function(s) s$levels)
strata_names  <- sapply(strata, function(s) s$id)
combos <- expand.grid(strata_levels, stringsAsFactors = FALSE)
colnames(combos) <- strata_names

EXPECTED_PER_STRATUM_SITE <- 20L
EXPECTED_TOTAL <- length(sites) * nrow(combos) * EXPECTED_PER_STRATUM_SITE

# ---------------------------------------------------------------------------
# Block-generation helper (Fisher-Yates via sample())
# ---------------------------------------------------------------------------

generate_block <- function(block_size) {
  multiplier <- block_size %/% total_ratio
  block <- character(0)
  for (arm in arms) {
    block <- c(block, rep(arm$name, arm$ratio * multiplier))
  }
  sample(block)  # base R Fisher-Yates shuffle
}

# ---------------------------------------------------------------------------
# Schema generation (MANUAL_MATRIX / intersection caps)
# ---------------------------------------------------------------------------

generate_schema <- function(seed) {
  set.seed(seed)
  schema <- list()
  row_idx <- 1L

  for (site in sites) {
    site_subject_count <- 0L

    for (i in seq_len(nrow(combos))) {
      combo   <- combos[i, , drop = FALSE]
      cap_key <- paste(as.character(combo), collapse = "|")
      cap     <- cap_matrix[[cap_key]]
      if (is.null(cap)) cap <- 0L

      stratum_subject_count <- 0L
      block_number          <- 1L

      while (stratum_subject_count < cap) {
        bs    <- sample(block_sizes, 1)
        block <- generate_block(bs)

        for (treatment in block) {
          site_subject_count    <- site_subject_count    + 1L
          stratum_subject_count <- stratum_subject_count + 1L

          row <- list(
            SubjectID   = sprintf("%s-%03d", site, site_subject_count),
            Site        = site,
            BlockNumber = block_number,
            BlockSize   = bs,
            Treatment   = treatment
          )
          for (col in strata_names) {
            row[[col]] <- as.character(combo[[col]])
          }
          schema[[row_idx]] <- row
          row_idx <- row_idx + 1L

          if (stratum_subject_count >= cap) break
        }

        block_number <- block_number + 1L
      }
    }
  }

  do.call(rbind, lapply(schema, as.data.frame, stringsAsFactors = FALSE))
}

# ---------------------------------------------------------------------------
# Assertions
# ---------------------------------------------------------------------------

assert_structural_properties <- function(df) {
  failures <- character(0)

  # 1. Total subject count
  if (nrow(df) != EXPECTED_TOTAL) {
    failures <- c(failures, sprintf(
      "Total subjects: expected %d, got %d", EXPECTED_TOTAL, nrow(df)
    ))
  }

  # 2. Arm names
  observed_arms <- sort(unique(df$Treatment))
  expected_arms <- sort(arm_names)
  if (!identical(observed_arms, expected_arms)) {
    failures <- c(failures, sprintf(
      "Arms: expected [%s], got [%s]",
      paste(expected_arms, collapse = ", "),
      paste(observed_arms, collapse = ", ")
    ))
  }

  # 3. Sites
  observed_sites <- sort(unique(df$Site))
  expected_sites <- sort(sites)
  if (!identical(observed_sites, expected_sites)) {
    failures <- c(failures, sprintf(
      "Sites: expected [%s], got [%s]",
      paste(expected_sites, collapse = ", "),
      paste(observed_sites, collapse = ", ")
    ))
  }

  # 4. Block internal balance
  block_keys <- paste(df$Site, df$sex, df$age, df$BlockNumber, sep = "|")
  for (key in unique(block_keys)) {
    subset_df <- df[block_keys == key, ]
    bs <- nrow(subset_df)
    if (bs != block_sizes[1]) next  # partial last block
    for (arm in arms) {
      expected_count <- bs %/% total_ratio
      actual_count   <- sum(subset_df$Treatment == arm$name)
      if (actual_count != expected_count) {
        failures <- c(failures, sprintf(
          "Block '%s': arm '%s' count %d != expected %d",
          key, arm$name, actual_count, expected_count
        ))
      }
    }
  }

  # 5. Stratum cap enforcement
  site_stratum_keys <- paste(df$Site, df$sex, df$age, sep = "|")
  site_stratum_counts <- table(site_stratum_keys)
  for (k in names(site_stratum_counts)) {
    count <- as.integer(site_stratum_counts[k])
    if (count > EXPECTED_PER_STRATUM_SITE) {
      failures <- c(failures, sprintf(
        "Stratum cap exceeded: '%s' has %d > %d", k, count, EXPECTED_PER_STRATUM_SITE
      ))
    }
  }

  # 6. Overall allocation ratio (1:1 → ±1 pp)
  grand_total <- nrow(df)
  for (arm in arms) {
    expected_frac <- arm$ratio / total_ratio
    actual_count  <- sum(df$Treatment == arm$name)
    observed_frac <- actual_count / grand_total
    deviation     <- abs(observed_frac - expected_frac)
    if (deviation > 0.01) {
      failures <- c(failures, sprintf(
        "Arm '%s' allocation deviation %.4f%% exceeds 1%% tolerance",
        arm$name, deviation * 100
      ))
    }
  }

  failures
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

cat(sprintf("Cross-Environment Equivalence Check (R)\n"))
cat(sprintf("  Protocol: %s\n", PROTOCOL_ID))
cat(sprintf("  Seed:     %d\n", SEED))
cat(sprintf("  Expected subjects: %d\n\n", EXPECTED_TOTAL))

df       <- generate_schema(SEED)
failures <- assert_structural_properties(df)

if (length(failures) > 0) {
  cat("FAILURES:\n")
  for (msg in failures) cat(sprintf("  x %s\n", msg))
  cat(sprintf("\nCROSS_ENV_CHECK: FAIL (%d assertion(s) failed)\n", length(failures)))
  quit(status = 1)
}

arm_counts <- table(df$Treatment)
cat(sprintf("  Total subjects generated: %d\n", nrow(df)))
for (nm in names(arm_counts)) {
  pct <- arm_counts[nm] / nrow(df) * 100
  cat(sprintf("  %s: %d (%.1f%%)\n", nm, arm_counts[nm], pct))
}
cat(sprintf("\nCROSS_ENV_CHECK: PASS — all %d subjects verified\n", nrow(df)))
quit(status = 0)
