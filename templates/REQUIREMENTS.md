---
project: {{PROJECT}}
status: living
created: {{DATE}}
updated: {{DATE}}
---

# REQUIREMENTS — {{PROJECT}}

## Context

<!-- 2–5 sentences: what this project is for and who it serves.
Filled in by hand, or proposed by AH when a new R-NNNN entry is
added during /ah:task-new or /ah:task-discuss. -->

## Requirements

<!-- R-NNNN entries appear here. The first one is added inline by
/ah:task-new (option `new`) or /ah:task-discuss (post-discussion).

Format:

### R-NNNN — <short title>

<1–3 sentences describing the requirement. What must be true of the
system for this requirement to be satisfied?>

**Rationale**: <why this requirement exists; the business / user /
system need it serves.>

**Linked tasks**: T-NNN, T-NNN  (maintained automatically by /ah:task-new
when a task declares `implements: [R-NNNN]` in its frontmatter).
-->

## Out of scope

<!-- Bullet list of things explicitly NOT requirements, to anchor
future discussions. Optional. -->

## Historicized decisions

<!-- Requirements that were declined, superseded, or merged.
Empty at bootstrap. AH appends entries here when /ah:task-discuss
amends an existing R-NNNN (one-line audit entry per change). -->

## Release history

<!-- One line per consumer release / milestone, listing the R-NNNN
introduced or updated. Populated manually by the dev. -->
