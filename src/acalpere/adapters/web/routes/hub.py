"""API del hub: webs i agents. Només per a administradors."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ....bootstrap import Container
from .. import shapes
from ..deps import admin_user, container

router = APIRouter(prefix="/hub", tags=["hub"], dependencies=[Depends(admin_user)])


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
def sites(c: Container = Depends(container)):
    return [shapes.site(s) for s in c.hub.sites()]


@router.post("/sites", status_code=201)
def create_site(body: SiteIn, c: Container = Depends(container)):
    return shapes.site(c.hub.create_site(body.name, body.url, body.status, body.notes))


@router.get("/sites/{site_id}")
def site(site_id: int, c: Container = Depends(container)):
    return shapes.site(c.hub.site(site_id))


@router.patch("/sites/{site_id}")
def update_site(site_id: int, body: SitePatch, c: Container = Depends(container)):
    return shapes.site(c.hub.update_site(site_id, **body.model_dump(exclude_unset=True)))


@router.delete("/sites/{site_id}", status_code=204)
def delete_site(site_id: int, c: Container = Depends(container)):
    c.hub.delete_site(site_id)


@router.get("/agents")
def agents(c: Container = Depends(container)):
    return [shapes.agent(a) for a in c.hub.agents()]


@router.post("/agents", status_code=201)
def create_agent(body: AgentIn, c: Container = Depends(container)):
    return shapes.agent(
        c.hub.create_agent(body.name, body.kind, body.enabled, body.site_id, body.config)
    )


@router.get("/agents/{agent_id}")
def agent(agent_id: int, c: Container = Depends(container)):
    return shapes.agent(c.hub.agent(agent_id))


@router.patch("/agents/{agent_id}")
def update_agent(agent_id: int, body: AgentPatch, c: Container = Depends(container)):
    return shapes.agent(c.hub.update_agent(agent_id, **body.model_dump(exclude_unset=True)))


@router.delete("/agents/{agent_id}", status_code=204)
def delete_agent(agent_id: int, c: Container = Depends(container)):
    c.hub.delete_agent(agent_id)
