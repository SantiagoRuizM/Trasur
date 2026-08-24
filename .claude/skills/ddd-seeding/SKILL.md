---
name: ddd-seeding
description: Add a database seed generator for a model so initdb can populate it, or understand cleandb teardown, in the Proyecto3 backend system app. Use when asked to seed/generate sample data for a new model, register an initdb generator, or wire up test/dev data.
---

# Seeding (`initdb`) & teardown (`cleandb`)

The `system` app drives data seeding via a **generator registry** with topological dependency resolution.
Full context in [development.md](../../../backend/development.md) §10.

## Layout (verified paths)

- Generators: `proyecto3/apps/system/application/services/generators/<model>.py`
  (base classes in `base.py`, registry in `registry.py`). Reference:
  [generators/asset_type.py](../../../backend/proyecto3/apps/system/application/services/generators/asset_type.py).
- Command: `proyecto3/apps/system/presentation/cli/management/commands/initdb.py` (the real one;
  `system/management/commands/initdb.py` is a thin re-export so Django discovers it).
- Run: `uv run python manage.py initdb --all` (or `--models <name> ...`); flags `-r/--randomize`, `-s/--seed`,
  `-lg/--list-generators`, `-so/--show-order`. **Needs Postgres up** (docker compose).

## Add a generator for a new model

1. Create `generators/<model>.py`. Inherit `BatchGenerator` (most common), `SingletonGenerator` (one special
   record), or `ContextualGenerator` (children per parent). Decorate with
   `@register_generator(name="<model>", depends_on=[...])` — deps are other generator `name`s (e.g.
   `["superadmin", "company"]`); the engine resolves execution order from them.

   ```python
   import factory
   from proyecto3.apps.<app>.domain.entities.<model> import <Model>
   from proyecto3.apps.<app>.factories.<model> import <Model>Factory
   from proyecto3.apps.companies.domain.entities.company import Company
   from proyecto3.apps.system.application.services.generators.base import BatchGenerator
   from proyecto3.apps.system.application.services.generators.registry import register_generator
   from proyecto3.apps.users.domain.entities.user import User

   @register_generator(name="<model>", depends_on=["superadmin", "company"])
   class <Model>Generator(BatchGenerator):
       def generate(self, count: int, **_: object) -> list[<Model>]:  # type: ignore[override]
           self.log_start(f"Generating {count} <models>...")
           admin = User.objects.filter(is_superuser=True).first()
           companies = list(Company.objects.all())
           if not admin or not companies:
               self.log_error("Missing deps", ValueError("superadmin/company missing")); return []
           real_count = self.rand_count(count)
           try:
               items: list[<Model>] = <Model>Factory.create_batch(
                   real_count, created_by=admin.uuid, company=factory.Iterator(companies),
               )
               self.log_complete("<Model>s generated", len(items)); return items
           except Exception as e:
               self.log_error("Failed to generate <models>", e); return []
   ```

   **Domain compliance:** build records via the `<Model>Factory` (or the `Create<Model>UseCase`) so
   `full_clean()` runs — never silent `bulk_create()`.

2. Ensure the generator module is imported by the registry's discovery (follow how the existing generators in
   that folder are picked up — they're decorated and discovered; mirror an existing sibling exactly).

3. Wire the count in `initdb.py`: add a CLI arg in `add_arguments()` and map it into the `counts` dict in
   `handle()` under your generator's registry `name` (e.g. `"<model>": options.get("<models>", 10)`).

4. Verify: `uv run python manage.py initdb -lg` lists it; `-so` shows it in dependency order;
   `initdb --models <model>` runs it.

## Teardown — `cleandb`

`uv run python manage.py cleandb` is fully dynamic: a `DependencyResolver` inspects `model._meta.get_fields()`,
builds a topological graph, and deletes leaf→root avoiding FK/M2M `IntegrityError`. **No per-model setup** — a
new model with standard `ForeignKey`s is handled automatically.
