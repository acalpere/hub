"""Casos d'ús del hub: webs i agents gestionats des d'un lloc central."""

from __future__ import annotations

from dataclasses import replace

from ..domain.errors import Forbidden, InvalidInput, NotFound
from ..domain.hub import SITE_STATUSES, Access, Agent, Site
from ..domain.identity import User
from ..domain.ports import (
    AccessRepository,
    AgentRepository,
    ContentRepository,
    SiteRepository,
    UserRepository,
)


class HubService:
    def __init__(
        self,
        sites: SiteRepository,
        agents: AgentRepository,
        access: AccessRepository,
        users: UserRepository,
        contents: ContentRepository,
    ):
        self._contents = contents
        self._sites = sites
        self._agents = agents
        self._access = access
        self._users = users

    # autoritzacions: l'administrador ho veu tot; la resta, només el que se li ha assignat
    def visible_sites(self, user: User) -> list[Site]:
        if user.is_admin:
            return self._sites.list()
        allowed = self._access.get(user.id).site_ids
        return [s for s in self._sites.list() if s.id in allowed]

    def visible_agents(self, user: User) -> list[Agent]:
        if user.is_admin:
            return self._agents.list()
        allowed = self._access.get(user.id).agent_ids
        return [a for a in self._agents.list() if a.id in allowed]

    def can_work_with(self, user: User, agent_id: int) -> bool:
        return user.is_admin or agent_id in self._access.get(user.id).work_agent_ids

    def access_of(self, user_id: int) -> Access:
        if self._users.get(user_id) is None:
            raise NotFound("Usuari no trobat")
        return self._access.get(user_id)

    def set_access(
        self,
        user_id: int,
        site_ids: list[int],
        agent_ids: list[int],
        work_agent_ids: list[int],
        content_ids: list[int],
    ) -> Access:
        self.access_of(user_id)
        sites = {s.id for s in self._sites.list()}
        agents = {a.id for a in self._agents.list()}
        contents = {c.id for c in self._contents.list()}
        if (
            not set(site_ids) <= sites
            or not set(agent_ids) | set(work_agent_ids) <= agents
            or not set(content_ids) <= contents
        ):
            raise InvalidInput("Hi ha elements que no existeixen")
        # Poder treballar amb un agent implica poder-lo veure.
        access = Access(
            frozenset(site_ids),
            frozenset(agent_ids) | frozenset(work_agent_ids),
            frozenset(work_agent_ids),
            frozenset(content_ids),
        )
        self._access.set(user_id, access)
        return access

    def set_agent_enabled(self, user: User, agent_id: int, enabled: bool) -> Agent:
        """Engegar o aturar un agent: l'administrador o qui hi té permís per treballar-hi."""
        if not user.is_admin and agent_id not in self._access.get(user.id).work_agent_ids:
            raise Forbidden("No pots treballar amb aquest agent")
        return self.update_agent(agent_id, enabled=enabled)

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
