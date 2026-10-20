"""API del hub: tothom veu el que té autoritzat; només l'administrador gestiona webs i agents."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ....bootstrap import Container
from ....domain.identity import User
from .. import shapes
from ..deps import admin_user, container, current_user

router = APIRouter(prefix="/hub", tags=["hub"])
admin = [Depends(admin_user)]


class SiteIn(BaseModel):
    name: str = Field(max_length=100)
    url: str = Field(max_length=500)
    status: str = "active"
    notes: str = Field(default="", max_length=4000)


class SitePatch(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    url: str | None = Field(default=None, max_length=500)
    status: str | None = None
    notes: str | None = Field(default=None, max_length=4000)


class AgentIn(BaseModel):
    name: str = Field(max_length=100)
    kind: str = Field(max_length=50)
    enabled: bool = True
    site_id: int | None = None
    config: dict = Field(default_factory=dict)


class AgentPatch(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    kind: str | None = Field(default=None, max_length=50)
    enabled: bool | None = None
    site_id: int | None = None
    config: dict | None = None


@router.get("/sites")
def sites(user: User = Depends(current_user), c: Container = Depends(container)):
    return [shapes.site(s) for s in c.hub.visible_sites(user)]


@router.post("/sites", status_code=201, dependencies=admin)
def create_site(body: SiteIn, c: Container = Depends(container)):
    return shapes.site(c.hub.create_site(body.name, body.url, body.status, body.notes))


@router.get("/sites/{site_id}", dependencies=admin)
def site(site_id: int, c: Container = Depends(container)):
    return shapes.site(c.hub.site(site_id))


@router.patch("/sites/{site_id}", dependencies=admin)
def update_site(site_id: int, body: SitePatch, c: Container = Depends(container)):
    return shapes.site(c.hub.update_site(site_id, **body.model_dump(exclude_unset=True)))


@router.delete("/sites/{site_id}", status_code=204, dependencies=admin)
def delete_site(site_id: int, c: Container = Depends(container)):
    c.hub.delete_site(site_id)


@router.get("/agents")
def agents(user: User = Depends(current_user), c: Container = Depends(container)):
    return [
        {**shapes.agent(a), "can_work": c.hub.can_work_with(user, a.id)}
        for a in c.hub.visible_agents(user)
    ]


@router.post("/agents", status_code=201, dependencies=admin)
def create_agent(body: AgentIn, c: Container = Depends(container)):
    return shapes.agent(
        c.hub.create_agent(body.name, body.kind, body.enabled, body.site_id, body.config)
    )


class EnabledIn(BaseModel):
    enabled: bool


@router.put("/agents/{agent_id}/enabled")
def set_agent_enabled(
    agent_id: int,
    body: EnabledIn,
    user: User = Depends(current_user),
    c: Container = Depends(container),
):
    return shapes.agent(c.hub.set_agent_enabled(user, agent_id, body.enabled))


@router.get("/agents/{agent_id}", dependencies=admin)
def agent(agent_id: int, c: Container = Depends(container)):
    return shapes.agent(c.hub.agent(agent_id))


@router.patch("/agents/{agent_id}", dependencies=admin)
def update_agent(agent_id: int, body: AgentPatch, c: Container = Depends(container)):
    return shapes.agent(c.hub.update_agent(agent_id, **body.model_dump(exclude_unset=True)))


@router.delete("/agents/{agent_id}", status_code=204, dependencies=admin)
def delete_agent(agent_id: int, c: Container = Depends(container)):
    c.hub.delete_agent(agent_id)
