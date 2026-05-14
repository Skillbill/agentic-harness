---
id: {{ID}}
title: {{TITLE}}
status: backlog
estimate: null
progress: null
assignee: null
branch: null
implements: {{IMPLEMENTS}}
created: {{DATE}}
updated: {{DATE}}
---

## Context

<!-- Why does this task exist? What problem does it solve? What feature does it enable? -->

## Goal

<!-- Concrete description of what must be done. Clear scope. -->

## Definition of Done

- [ ] Implementation complete
- [ ] `npm run lint` passes in the touched components
- [ ] `npm run typecheck` passes (if applicable: server, configurator, nvd, e2e-server-tests)
- [ ] `npm run build` passes in the touched components
- [ ] Tests updated/added if applicable (e2e-server-tests, hmi, etc.)
- [ ] If DB schema: Liquibase migration created and tested
- [ ] Documentation updated (AGENTS.md, component READMEs, config/)
- [ ] Backward compatibility verified (project constraint)
- [ ] PR opened and approved

## Log

<!-- The dev adds notes here during the work. -->
