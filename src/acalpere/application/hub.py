"""Casos d'ús del hub: webs i agents gestionats des d'un lloc central."""

from __future__ import annotations

from dataclasses import replace

from ..domain.errors import InvalidInput, NotFound
from ..domain.hub import SITE_STATUSES, Agent, Site
from ..domain.ports import AgentRepository, SiteRepository


class HubService:
    def __init__(self, sites: SiteRepository, agents: AgentRepository):
        self._sites = sites
        self._agents = agents

    # webs
    def sites(self) -> list[Site]:
        return self._sites.list()

    def site(self, site_id: int) -> Site:
        site = self._sites.get(site_id)
        if site is None:
            raise NotFound("Web no trobada")
        return site

    def create_site(self, name: str, url: str, status: str = "active", notes: str = "") -> Site:
        return self._sites.save(self._validated_site(Site(None, name, url, status, notes)))

    def update_site(self, site_id: int, **changes) -> Site:
        site = replace(self.site(site_id), **changes)
        return self._sites.save(self._validated_site(site))

    def delete_site(self, site_id: int) -> None:
        if not self._sites.delete(site_id):
            raise NotFound("Web no trobada")

    @staticmethod
    def _validated_site(site: Site) -> Site:
        name, url = site.name.strip(), site.url.strip()
        if not name:
            raise InvalidInput("Cal un nom")
        if not url.startswith(("http://", "https://")):
            raise InvalidInput("L'adreça ha de començar per http:// o https://")
        if site.status not in SITE_STATUSES:
            raise InvalidInput(f"Estat no vàlid: {site.status}")
        return replace(site, name=name, url=url)

    # agents
    def agents(self) -> list[Agent]:
        return self._agents.list()

    def agent(self, agent_id: int) -> Agent:
        agent = self._agents.get(agent_id)
        if agent is None:
            raise NotFound("Agent no trobat")
        return agent

    def create_agent(
        self,
        name: str,
        kind: str,
        enabled: bool = True,
        site_id: int | None = None,
        config: dict | None = None,
    ) -> Agent:
        return self._agents.save(
            self._validated_agent(Agent(None, name, kind, enabled, site_id, config or {}))
        )

    def update_agent(self, agent_id: int, **changes) -> Agent:
        agent = replace(self.agent(agent_id), **changes)
        return self._agents.save(self._validated_agent(agent))

    def delete_agent(self, agent_id: int) -> None:
        if not self._agents.delete(agent_id):
            raise NotFound("Agent no trobat")

    def _validated_agent(self, agent: Agent) -> Agent:
        name, kind = agent.name.strip(), agent.kind.strip()
        if not name or not kind:
            raise InvalidInput("Cal un nom i un tipus")
        if agent.site_id is not None and self._sites.get(agent.site_id) is None:
            raise InvalidInput("La web indicada no existeix")
        return replace(agent, name=name, kind=kind)
