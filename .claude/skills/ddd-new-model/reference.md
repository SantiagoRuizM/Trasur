# Per-layer templates (derived verbatim from the `AssetType` reference)

Substitute `<Model>` / `<model>` / `<models>` / `<app>` / `<model_no_under>`. These mirror the live files in
`proyecto3/apps/companies/.../asset_type.py`. For a **global** (non-tenant) model, swap `TenantModel`→`CoreModel`,
`TenantManager`→`CoreManager`, `TenantQuerySet`→`CoreQuerySet`, drop the `company` FK and `company_uuid` plumbing,
and use a plain `GenericViewSet`/`CoreViewSet` instead of `TenantScopedCoreViewSet` (see the `core` app's
`CustomField` for a tenant model living in `core`).

---

## 1. Entity — `domain/entities/<model>.py`

```python
from typing import ClassVar

from django.db import models
from django.utils.translation import gettext_lazy as _

from proyecto3.apps.companies.domain.entities.company import Company
from proyecto3.apps.<app>.domain.value_objects.permissions import <Model>Permissions
from proyecto3.apps.core.domain.entities.tenant import TenantManager, TenantModel, TenantQuerySet


class <Model>QuerySet(TenantQuerySet["<Model>"]):
    search_fields: ClassVar = ["name"]


class <Model>Manager(TenantManager["<Model>"]):
    def get_queryset(self) -> <Model>QuerySet:
        return <Model>QuerySet(self.model, using=self._db)


class <Model>(TenantModel):
    company: Company = models.ForeignKey(  # type: ignore[assignment]
        "companies.Company",
        null=False,
        blank=False,
        on_delete=models.CASCADE,
        related_name="<models>",
        verbose_name=_("Company"),
        help_text=_("Company this <model> belongs to."),
    )
    name = models.CharField(max_length=255, verbose_name="<Model> Name", help_text="Name of the <model>")

    objects: <Model>Manager = <Model>Manager()

    class Meta:
        verbose_name = _("<Model>")
        verbose_name_plural = _("<Model>s")
        ordering: ClassVar = ["name"]
        unique_together = ("company", "name")
        permissions: ClassVar = <Model>Permissions.get_permissions_tuple_list()  # type: ignore[assignment]

    def clean(self) -> None:
        super().clean()
        # Business invariants -> raise a DomainError subclass (see skill ddd-domain-errors). Example:
        # if <broken rule>:
        #     raise <Model>ValidationError(message=str(_("...")), origin="<Model>.clean")

    def __str__(self) -> str:
        return f"{self.name} ({self.company.name})"
```

Then in `<app>/models.py`: `from proyecto3.apps.<app>.domain.entities.<model> import <Model>`.

---

## 2. Permissions — append to `domain/value_objects/permissions.py`

```python
class <Model>Permissions(BasePermissions):
    ADD_<MODEL> = "add_<model_no_under>"
    CHANGE_<MODEL> = "change_<model_no_under>"
    DELETE_<MODEL> = "delete_<model_no_under>"
    VIEW_<MODEL> = "view_<model_no_under>"

    ACTIVATE_<MODEL> = "activate_<model_no_under>"
    DEACTIVATE_<MODEL> = "deactivate_<model_no_under>"
```

`BasePermissions.get_permissions_tuple_list()` auto-excludes the 4 default Django perms, registering only the
custom ones (activate/deactivate/...). `auto()` works too when the enum name lowercased already matches the
codename, but spelling the string is safest for multi-word models.

---

## 3. DTOs — `domain/dtos/<model>.py`

```python
from uuid import UUID

from proyecto3.apps.core.domain.dtos.core import CoreDTO, TenantScopedAuthContext


class Create<Model>Request(CoreDTO):
    created_by_uuid: UUID
    company_uuid: UUID
    name: str


class Update<Model>Request(CoreDTO):
    updated_by_uuid: UUID
    <model>_uuid: UUID
    name: str | None = None


class <Model>ViewContext(TenantScopedAuthContext):
    target_<model>_uuid: UUID
```

---

## 4. Exceptions — append to `domain/exceptions.py`

Add codes to the app's error-code `StrEnum`, then:

```python
class <Model>DoesNotExistError(DomainError):
    code = <App>ErrorCodes.<MODEL>_NOT_FOUND
    message = "<Model> does not exist"
    status_code = status.HTTP_404_NOT_FOUND
    category = ErrorCategory.NOT_FOUND


class <Model>AlreadyExistsError(DomainError):
    code = <App>ErrorCodes.<MODEL>_ALREADY_EXISTS
    message = "<Model> already exists"
    status_code = status.HTTP_409_CONFLICT
    category = ErrorCategory.BUSINESS_RULE


# Only if clean() enforces invariants:
class <Model>ValidationError(DomainError):
    code = <App>ErrorCodes.<MODEL>_VALIDATION_ERROR
    message = "<Model> validation error"
    status_code = status.HTTP_400_BAD_REQUEST
    category = ErrorCategory.BUSINESS_RULE
```

---

## 5. Driver ports — `domain/ports/drivers/<model>.py`

```python
from abc import ABC, abstractmethod
from typing import Any
from uuid import UUID

from proyecto3.apps.<app>.domain.dtos.<model> import Create<Model>Request, Update<Model>Request
from proyecto3.apps.<app>.domain.entities.<model> import <Model>, <Model>QuerySet


class ICreate<Model>UseCase(ABC):
    @abstractmethod
    def create_<model>(self, <model>_data: Create<Model>Request) -> <Model>: pass


class IGetOrCreate<Model>UseCase(ABC):
    @abstractmethod
    def get_or_create_<model>(self, <model>_data: Create<Model>Request) -> <Model>: pass


class IUpdate<Model>UseCase(ABC):
    @abstractmethod
    def update_<model>(self, <model>_data: Update<Model>Request) -> <Model>: pass


class IRetrieve<Model>UseCase(ABC):
    @abstractmethod
    def retrieve_<model>(self, *args: Any, include_deactivated: bool = False, **kwargs: Any) -> <Model>: pass


class IFilter<Model>sUseCase(ABC):
    @abstractmethod
    def filter_<models>(self, *args: Any, include_deactivated: bool = False, **kwargs: Any) -> <Model>QuerySet: pass


class IDeactivate<Model>UseCase(ABC):
    @abstractmethod
    def deactivate_<model>(self, <model>_uuid: UUID) -> <Model>: pass


class IActivate<Model>UseCase(ABC):
    @abstractmethod
    def activate_<model>(self, <model>_uuid: UUID) -> <Model>: pass


class IDelete<Model>UseCase(ABC):
    @abstractmethod
    def delete_<model>(self, <model>_uuid: UUID) -> None: pass


class I<Model>ManagementDriverPort(ABC):
    create: ICreate<Model>UseCase
    get_or_create: IGetOrCreate<Model>UseCase
    update: IUpdate<Model>UseCase
    retrieve: IRetrieve<Model>UseCase
    filter: IFilter<Model>sUseCase
    activate: IActivate<Model>UseCase
    deactivate: IDeactivate<Model>UseCase
    delete: IDelete<Model>UseCase
```

The **service interface** `domain/services/<model>.py` is the same method set as the impl below, as `@abstractmethod`s
(see `proyecto3/apps/companies/domain/services/asset_type.py`).

---

## 6. Service impl — `application/services/<model>.py`

```python
from typing import Any
from uuid import UUID

from django.core.exceptions import ValidationError
from django.db import IntegrityError

from proyecto3.apps.<app>.domain.dtos.<model> import Create<Model>Request, Update<Model>Request
from proyecto3.apps.<app>.domain.entities.<model> import <Model>, <Model>QuerySet
from proyecto3.apps.<app>.domain.exceptions import <Model>AlreadyExistsError, <Model>DoesNotExistError
from proyecto3.apps.<app>.domain.services.<model> import I<Model>Service


class <Model>Service(I<Model>Service):
    def create_<model>(self, <model>_data: Create<Model>Request) -> <Model>:
        try:
            return <Model>.objects.create(
                name=<model>_data.name,
                company_id=<model>_data.company_uuid,
                created_by_id=<model>_data.created_by_uuid,
                updated_by_id=<model>_data.created_by_uuid,
            )
        except IntegrityError as exc:
            raise <Model>AlreadyExistsError from exc

    def get_or_create_<model>(self, <model>_data: Create<Model>Request) -> <Model>:
        try:
            return self.create_<model>(<model>_data)
        except <Model>AlreadyExistsError:
            return self.retrieve_<model>(name=<model>_data.name, company_id=<model>_data.company_uuid)

    def update_<model>(self, <model>: <Model>, <model>_data: Update<Model>Request) -> <Model>:
        data = <model>_data.model_dump_with_mapped_ids(exclude_unset=True, exclude={"<model>_uuid"})
        for field, value in data.items():
            setattr(<model>, field, value)
        <model>.save()
        return <model>

    def update_<model>_by_uuid(self, <model>_data: Update<Model>Request) -> <Model>:
        return self.update_<model>(self.retrieve_<model>(uuid=<model>_data.<model>_uuid), <model>_data)

    def retrieve_<model>_from_queryset(self, queryset, *args, include_deactivated=False, **kwargs) -> <Model>:
        qs = queryset if include_deactivated else queryset.active()
        try:
            return qs.get(*args, **kwargs)
        except <Model>.DoesNotExist as exc:
            raise <Model>DoesNotExistError(
                origin="<Model>Service.retrieve_<model>_from_queryset",
                details={"args": args, "kwargs": kwargs, "include_deactivated": include_deactivated},
            ) from exc

    def retrieve_<model>(self, *args, include_deactivated=False, **kwargs) -> <Model>:
        return self.retrieve_<model>_from_queryset(
            <Model>.objects.get_queryset(), *args, include_deactivated=include_deactivated, **kwargs
        )

    def filter_<models>_from_queryset(self, queryset, *args, include_deactivated=False, **kwargs) -> <Model>QuerySet:
        qs = queryset if include_deactivated else queryset.active()
        return qs.filter(*args, **kwargs)

    def filter_<models>(self, *args, include_deactivated=False, **kwargs) -> <Model>QuerySet:
        return self.filter_<models>_from_queryset(
            <Model>.objects.get_queryset(), *args, include_deactivated=include_deactivated, **kwargs
        )

    def deactivate_<model>(self, <model>: <Model>, executed_by_uuid: UUID) -> <Model>:
        <model>.updated_by_id = executed_by_uuid
        <model>.deactivate()
        <model>.save()
        return <model>

    def deactivate_<model>_by_uuid(self, uuid: UUID, executed_by_uuid: UUID) -> <Model>:
        return self.deactivate_<model>(self.retrieve_<model>(uuid=uuid, include_deactivated=True), executed_by_uuid)

    def activate_<model>(self, <model>: <Model>, executed_by_uuid: UUID) -> <Model>:
        <model>.updated_by_id = executed_by_uuid
        <model>.activate()
        <model>.save()
        return <model>

    def activate_<model>_by_uuid(self, uuid: UUID, executed_by_uuid: UUID) -> <Model>:
        return self.activate_<model>(self.retrieve_<model>(uuid=uuid, include_deactivated=True), executed_by_uuid)

    def delete_<model>(self, <model>: <Model>) -> None:
        <model>.delete()

    def delete_<model>_by_uuid(self, uuid: UUID) -> None:
        self.delete_<model>(self.retrieve_<model>(uuid=uuid, include_deactivated=True))
```

---

## 7. Use cases — `application/use_cases/<model>.py`

```python
from typing import Any
from uuid import UUID

from proyecto3.apps.<app>.application.services.<model> import <Model>Service
from proyecto3.apps.<app>.domain.dtos.<model> import Create<Model>Request, Update<Model>Request
from proyecto3.apps.<app>.domain.entities.<model> import <Model>, <Model>QuerySet
from proyecto3.apps.<app>.domain.ports.drivers.<model> import (
    IActivate<Model>UseCase, I<Model>ManagementDriverPort, ICreate<Model>UseCase,
    IDeactivate<Model>UseCase, IDelete<Model>UseCase, IFilter<Model>sUseCase,
    IGetOrCreate<Model>UseCase, IRetrieve<Model>UseCase, IUpdate<Model>UseCase,
)

_<model>_service = <Model>Service()


class Create<Model>UseCase(ICreate<Model>UseCase):
    def create_<model>(self, <model>_data: Create<Model>Request) -> <Model>:
        return _<model>_service.create_<model>(<model>_data)


class GetOrCreate<Model>UseCase(IGetOrCreate<Model>UseCase):
    def get_or_create_<model>(self, <model>_data: Create<Model>Request) -> <Model>:
        return _<model>_service.get_or_create_<model>(<model>_data)


class Update<Model>UseCase(IUpdate<Model>UseCase):
    def update_<model>(self, <model>_data: Update<Model>Request) -> <Model>:
        return _<model>_service.update_<model>_by_uuid(<model>_data)


class Retrieve<Model>UseCase(IRetrieve<Model>UseCase):
    def retrieve_<model>(self, *args: Any, include_deactivated: bool = False, **kwargs: Any) -> <Model>:
        return _<model>_service.retrieve_<model>(*args, include_deactivated=include_deactivated, **kwargs)


class Filter<Model>sUseCase(IFilter<Model>sUseCase):
    def filter_<models>(self, *args: Any, include_deactivated: bool = False, **kwargs: Any) -> <Model>QuerySet:
        return _<model>_service.filter_<models>(*args, include_deactivated=include_deactivated, **kwargs)


class Deactivate<Model>UseCase(IDeactivate<Model>UseCase):
    def __init__(self, executed_by_uuid: UUID) -> None:
        self.executed_by_uuid = executed_by_uuid

    def deactivate_<model>(self, <model>_uuid: UUID) -> <Model>:
        return _<model>_service.deactivate_<model>_by_uuid(<model>_uuid, self.executed_by_uuid)


class Activate<Model>UseCase(IActivate<Model>UseCase):
    def __init__(self, executed_by_uuid: UUID) -> None:
        self.executed_by_uuid = executed_by_uuid

    def activate_<model>(self, <model>_uuid: UUID) -> <Model>:
        return _<model>_service.activate_<model>_by_uuid(<model>_uuid, self.executed_by_uuid)


class Delete<Model>UseCase(IDelete<Model>UseCase):
    def delete_<model>(self, <model>_uuid: UUID) -> None:
        return _<model>_service.delete_<model>_by_uuid(<model>_uuid)


class <Model>ManagementDriverPort(I<Model>ManagementDriverPort):
    def __init__(self, executed_by_uuid: UUID) -> None:
        self.create = Create<Model>UseCase()
        self.get_or_create = GetOrCreate<Model>UseCase()
        self.update = Update<Model>UseCase()
        self.retrieve = Retrieve<Model>UseCase()
        self.filter = Filter<Model>sUseCase()
        self.activate = Activate<Model>UseCase(executed_by_uuid)
        self.deactivate = Deactivate<Model>UseCase(executed_by_uuid)
        self.delete = Delete<Model>UseCase()
```

---

## 8. Providers — `presentation/providers/<model>.py`

```python
from functools import lru_cache
from uuid import UUID

from proyecto3.apps.<app>.application.use_cases.<model> import (
    Activate<Model>UseCase, <Model>ManagementDriverPort, Create<Model>UseCase,
    Deactivate<Model>UseCase, Delete<Model>UseCase, Filter<Model>sUseCase,
    GetOrCreate<Model>UseCase, Retrieve<Model>UseCase, Update<Model>UseCase,
)


@lru_cache
def get_create_<model>_usecase() -> Create<Model>UseCase: return Create<Model>UseCase()

@lru_cache
def get_get_or_create_<model>_usecase() -> GetOrCreate<Model>UseCase: return GetOrCreate<Model>UseCase()

@lru_cache
def get_update_<model>_usecase() -> Update<Model>UseCase: return Update<Model>UseCase()

@lru_cache
def get_retrieve_<model>_usecase() -> Retrieve<Model>UseCase: return Retrieve<Model>UseCase()

@lru_cache
def get_filter_<models>_usecase() -> Filter<Model>sUseCase: return Filter<Model>sUseCase()

def get_deactivate_<model>_usecase(executed_by_uuid: UUID) -> Deactivate<Model>UseCase:
    return Deactivate<Model>UseCase(executed_by_uuid)

def get_activate_<model>_usecase(executed_by_uuid: UUID) -> Activate<Model>UseCase:
    return Activate<Model>UseCase(executed_by_uuid)

@lru_cache
def get_delete_<model>_usecase() -> Delete<Model>UseCase: return Delete<Model>UseCase()

def get_<model>_management_driver_port(executed_by_uuid: UUID) -> <Model>ManagementDriverPort:
    return <Model>ManagementDriverPort(executed_by_uuid)
```

---

## 9. Serializers — `presentation/api/serializers/<model>.py`

```python
from typing import Any, ClassVar
from uuid import UUID

from rest_framework import serializers

from proyecto3.apps.<app>.domain.dtos.<model> import (
    <Model>ViewContext, Create<Model>Request, Update<Model>Request,
)
from proyecto3.apps.<app>.domain.entities.<model> import <Model>
from proyecto3.apps.core.domain.dtos.core import AuthenticatedUserDefault, CurrentCompanyDefault
from proyecto3.apps.core.presentation.api.serializers.core import AbstractCoreModelSerializer


class ContextTarget<Model>:
    requires_context = True

    def __call__(self, serializer_field: Any) -> UUID:
        return <Model>ViewContext(**serializer_field.context).target_<model>_uuid


class <Model>Serializer(AbstractCoreModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)

    class Meta(AbstractCoreModelSerializer.Meta):
        model = <Model>
        fields: ClassVar[list[str]] = [*AbstractCoreModelSerializer.Meta.fields, "name", "company", "company_name"]


class Create<Model>RequestSerializer(serializers.Serializer[Create<Model>Request]):
    created_by_uuid = serializers.HiddenField(default=AuthenticatedUserDefault())
    company_uuid = serializers.HiddenField(default=CurrentCompanyDefault())
    name = serializers.CharField(max_length=255)

    def create(self, validated_data: dict[str, Any]) -> Create<Model>Request:
        return Create<Model>Request(**validated_data)


class Update<Model>RequestSerializer(serializers.Serializer[Update<Model>Request]):
    updated_by_uuid = serializers.HiddenField(default=AuthenticatedUserDefault())
    <model>_uuid = serializers.HiddenField(default=ContextTarget<Model>())
    name = serializers.CharField(max_length=255, required=False, allow_blank=False)

    def create(self, validated_data: dict[str, Any]) -> Update<Model>Request:
        return Update<Model>Request(**validated_data)
```

---

## 10. View — `presentation/api/views/<model>.py`

Mirror `proyecto3/apps/companies/presentation/api/views/asset_type.py` exactly. Key parts:

```python
@extend_schema(tags=["<Model>s"])
class <Model>ViewSet(TenantScopedCoreViewSet[<Model>]):
    queryset = <Model>.objects.select_related("company", "created_by", "updated_by").all()
    pagination_class = <Model>Pagination          # LimitOffsetPagination, default 250 / max 500
    filterset_class = <Model>FilterSet

    def get_permissions(self) -> list[BasePermission]:
        permission_classes = [IsAuthenticated(), TenantScopedPermission()]
        if self.action == "create":
            permission_classes.append(CorePermission(app="<app>", permission_to_check=<Model>Permissions.ADD_<MODEL>))
        # ... change/view/destroy/deactivate/activate, one per action
        return permission_classes

    def get_serializer_class(self) -> type[<Model>Serializer]:
        return <Model>Serializer

    def get_queryset(self) -> <Model>QuerySet:
        queryset = cast("<Model>QuerySet", super().get_queryset())
        return _<model>_service.filter_<models>_from_queryset(queryset=queryset).filter(company__uuid=self.company_uuid)

    @custom_extend_schema(request=Create<Model>RequestSerializer,
                          responses={status.HTTP_201_CREATED: <Model>Serializer},
                          exceptions=[<Model>AlreadyExistsError])
    def create(self, request, *args, **kwargs):
        context = TenantScopedAuthContext(logged_user_uuid=self.logged_user_uuid, company_uuid=self.company_uuid).model_dump()
        s = Create<Model>RequestSerializer(data=request.data, context=context); s.is_valid(raise_exception=True)
        <model> = get_create_<model>_usecase().create_<model>(s.save())
        return Response(self.get_serializer(<model>).data, status=status.HTTP_201_CREATED)

    # update(): build <Model>ViewContext(..., target_<model>_uuid=UUID(kwargs["pk"])); serializer.save(
    #   updated_by_uuid=self.logged_user_uuid, <model>_uuid=UUID(kwargs["pk"])); call get_update_<model>_usecase()
    # partial_update(): kwargs["partial"]=True; return self.update(...)
    # retrieve(): get_retrieve_<model>_usecase().retrieve_<model>(uuid=UUID(kwargs["pk"]))
    # list(): paginate _<model>_service.filter_<models>_from_queryset(self.filter_queryset(self.get_queryset()), include_deactivated=True)
    # @action PATCH deactivate / activate -> get_(de)activate_<model>_usecase(self.logged_user_uuid)
    # destroy(): get_delete_<model>_usecase().delete_<model>(UUID(kwargs["pk"]))  -> 204
```

If `destroy` is defined, add `http_method_names = [*TenantScopedCoreViewSet.http_method_names, "delete"]`.
`self.logged_user_uuid` and `self.company_uuid` come from `TenantScopedCoreViewSet` (cached properties) — never
re-read `request.user.uuid` / `kwargs["company_pk"]` manually.

---

## 11. URLs — `<app>/urls.py`

```python
_companies_router.register(r"<models>", <Model>ViewSet, basename="<models>")
```

Tests reverse names: `"<models>-list"`, `"<models>-detail"`, `"<models>-activate"`, `"<models>-deactivate"`.
