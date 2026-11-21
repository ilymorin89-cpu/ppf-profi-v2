# PPF PROFI Agent HQ — direct agent registry

This registry defines 19 specialist roles for the first controlled rollout. It is a role catalogue, not proof that 19 independent processes are running.

## Current execution reality

The existing worker currently accepts only these seven roles: `coordinator`, `web_engineer`, `seo`, `geo`, `growth`, `analytics`, and `qa_security`. They are marked `implemented` in the manifest because matching worker instructions and task routing exist in the current main branch.

The remaining twelve roles are marked `planned`. They must not be assigned to the current worker until database role constraints, worker allowlists, role-specific instructions, tests, and deployment configuration are updated together.

## Operating rules

1. Agent HQ coordinator owns decomposition and consolidation.
2. Each task has one accountable role, objective, expected output, acceptance criteria and bounded budget.
3. Specialist outputs must distinguish verified facts, inference and unknowns, and include evidence.
4. QA/security independently reviews the specialist artifacts and returns `PASS` or `REVISE`.
5. No publication, production deployment, external messaging, advertising launch, spending, database migration or data deletion without explicit owner approval.
6. Workers must not claim they accessed a system or performed an action unless tool evidence confirms it.
7. No OpenSEO dependency is required. Agents use Agent HQ's own task queue, database, model provider configuration and explicitly approved connectors.
8. The role catalogue does not itself start background processes. Runtime deployment and health checks are separate acceptance gates.

## Activation gates for planned roles

- Inspect and update database role constraints with a forward-only migration.
- Add each role to worker validation and role-specific system instructions.
- Add role-specific input/output schemas and capability policy.
- Add tests for routing, unauthorized role rejection, approval gates and QA handoff.
- Verify all roles against an isolated staging database before enabling production workers.
