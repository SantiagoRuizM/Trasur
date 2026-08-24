---
description: Scaffold a new DDD model across all backend layers (plan -> implement -> test -> check)
argument-hint: "<ModelName> <app> [tenant|global]  e.g. Warehouse companies tenant"
---

Drive the full new-model workflow for: **$ARGUMENTS**

Parse `$ARGUMENTS` as `<ModelName> <app> [scope]` (scope defaults to `tenant`). If the model name or app is
missing or the app isn't a real bounded context under `proyecto3/apps/`, ask me before proceeding.

Then execute this workflow:

1. **Plan** — use the `ddd-feature-planner` agent (or plan inline if the model is trivial CRUD) to produce the
   concrete per-layer file list and signatures, grounded in the `AssetType`/`Role` reference.
2. **Confirm** the plan with me (especially: fields, uniqueness constraints, any `clean()` invariants, custom
   actions beyond CRUD, tenant vs global).
3. **Implement** bottom-up following the **`ddd-new-model`** skill and its `reference.md` templates:
   entity → register in `models.py` → permissions → dtos → exceptions → ports → service iface + impl →
   use cases (+ management driver port) → providers → serializers → filters → view → register in `urls.py`.
4. **Tests** — write the exhaustive view suite via the **`ddd-view-tests`** skill; run it with `--no-cov`.
5. **Gate** — run `/backend-check`; then `/backend-migrate` for the schema change.
6. **Review** — run the `ddd-architecture-reviewer` agent on the diff and address findings.

Keep every signature byte-for-byte symmetric with the reference model so future models stay copy-able. Pause for
my approval at step 2 before writing any files.
