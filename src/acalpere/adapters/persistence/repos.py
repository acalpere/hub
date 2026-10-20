"""Implementacions SQLAlchemy dels ports de repositori."""

from __future__ import annotations

from dataclasses import fields
from datetime import date, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import sessionmaker

from ...domain.calendar import (
    Assignacio,
    Germa,
    HistoryEntry,
    LastModification,
    Modalitat,
)
from ...domain.hub import Access, Agent, Site
from ...domain.identity import Content, Passkey, Profile, User
from ...domain.inheritance import Fill, Finca, Missatge, Parametres, Pis
from . import models as m


def _now() -> datetime:
    return datetime.now().astimezone()


def _to(cls, row, **rename):
    """Dataclass del domini a partir d'una fila, amb camps que coincideixen pel nom."""
    values = {}
    for f in fields(cls):
        values[f.name] = getattr(row, rename.get(f.name, f.name))
    return cls(**values)


class SqlUserRepository:
    def __init__(self, sf: sessionmaker):
        self._sf = sf

    @staticmethod
    def _user(row: m.UserRow) -> User:
        return _to(User, row)

    def get(self, user_id: int) -> User | None:
        with self._sf() as s:
            row = s.get(m.UserRow, user_id)
            return self._user(row) if row else None

    def by_username(self, username: str) -> User | None:
        with self._sf() as s:
            row = s.scalar(
                select(m.UserRow).where(func.lower(m.UserRow.username) == username.lower())
            )
            return self._user(row) if row else None

    def list(self) -> list[User]:
        with self._sf() as s:
            return [self._user(r) for r in s.scalars(select(m.UserRow).order_by(m.UserRow.id))]

    def add(
        self, username: str, password_hash: str, role: str, profile: Profile | None = None
    ) -> User:
        p = profile or Profile()
        with self._sf.begin() as s:
            row = m.UserRow(
                username=username,
                password_hash=password_hash,
                role=role,
                first_name=p.first_name or None,
                last_name=p.last_name or None,
                email=p.email or None,
                phone=p.phone or None,
            )
            s.add(row)
            s.flush()
            return self._user(row)

    def update(self, user_id: int, username: str, role: str, profile: Profile) -> None:
        with self._sf.begin() as s:
            row = s.get(m.UserRow, user_id)
            if row:
                row.username, row.role = username, role
                row.first_name = profile.first_name or None
                row.last_name = profile.last_name or None
                row.email = profile.email or None
                row.phone = profile.phone or None

    def set_password(self, user_id: int, password_hash: str) -> None:
        with self._sf.begin() as s:
            row = s.get(m.UserRow, user_id)
            if row:
                row.password_hash = password_hash

    def set_role(self, user_id: int, role: str) -> None:
        with self._sf.begin() as s:
            row = s.get(m.UserRow, user_id)
            if row:
                row.role = role

    def set_totp_secret(self, user_id: int, secret: str | None) -> None:
        with self._sf.begin() as s:
            row = s.get(m.UserRow, user_id)
            if row:
                row.totp_secret = secret


class SqlPasskeyRepository:
    def __init__(self, sf: sessionmaker):
        self._sf = sf

    def for_user(self, user_id: int) -> list[Passkey]:
        with self._sf() as s:
            rows = s.scalars(
                select(m.PasskeyRow)
                .where(m.PasskeyRow.user_id == user_id)
                .order_by(m.PasskeyRow.id)
            )
            return [_to(Passkey, r) for r in rows]

    def by_credential_id(self, credential_id: str) -> Passkey | None:
        with self._sf() as s:
            row = s.scalar(select(m.PasskeyRow).where(m.PasskeyRow.credential_id == credential_id))
            return _to(Passkey, row) if row else None

    def add(self, passkey: Passkey) -> Passkey:
        with self._sf.begin() as s:
            row = m.PasskeyRow(
                user_id=passkey.user_id,
                credential_id=passkey.credential_id,
                public_key=passkey.public_key,
                sign_count=passkey.sign_count,
                label=passkey.label,
            )
            s.add(row)
            s.flush()
            return _to(Passkey, row)

    def set_sign_count(self, passkey_id: int, sign_count: int) -> None:
        with self._sf.begin() as s:
            row = s.get(m.PasskeyRow, passkey_id)
            if row:
                row.sign_count = sign_count

    def delete(self, user_id: int, passkey_id: int) -> bool:
        with self._sf.begin() as s:
            row = s.get(m.PasskeyRow, passkey_id)
            if row is None or row.user_id != user_id:
                return False
            s.delete(row)
            return True


class SqlContentRepository:
    def __init__(self, sf: sessionmaker):
        self._sf = sf

    def list(self) -> list[Content]:
        with self._sf() as s:
            return [
                Content(r.id, r.name, r.url, tuple(r.roles.split(",")), r.position)
                for r in s.scalars(
                    select(m.ContentRow).order_by(m.ContentRow.position, m.ContentRow.id)
                )
            ]


class SqlCalendarRepository:
    def __init__(self, sf: sessionmaker):
        self._sf = sf

    @staticmethod
    def _assignacio(r: m.AssignacioRow) -> Assignacio:
        return Assignacio(
            r.id, r.data_assignacio, r.germa_id, r.modalitat_id, r.creat_per, r.modificat_per,
            r.data_creacio, r.data_modificacio,
        )  # fmt: skip

    def germans(self) -> list[Germa]:
        with self._sf() as s:
            rows = s.scalars(select(m.GermaRow).where(m.GermaRow.actiu).order_by(m.GermaRow.id))
            return [_to(Germa, r) for r in rows]

    def modalitats(self) -> list[Modalitat]:
        with self._sf() as s:
            rows = s.scalars(
                select(m.ModalitatRow).where(m.ModalitatRow.actiu).order_by(m.ModalitatRow.id)
            )
            return [_to(Modalitat, r) for r in rows]

    def assignacions(self) -> list[Assignacio]:
        with self._sf() as s:
            rows = s.scalars(
                select(m.AssignacioRow).order_by(
                    m.AssignacioRow.data_assignacio, m.AssignacioRow.id
                )
            )
            return [self._assignacio(r) for r in rows]

    def assignacions_on(self, day: date) -> list[Assignacio]:
        with self._sf() as s:
            rows = s.scalars(select(m.AssignacioRow).where(m.AssignacioRow.data_assignacio == day))
            return [self._assignacio(r) for r in rows]

    def _touch(self, s) -> None:
        state = s.get(m.CalendarStateRow, 1)
        if state is None:
            s.add(m.CalendarStateRow(id=1, timestamp=_now()))
        else:
            state.timestamp = _now()

    def add(self, assignacio: Assignacio, entry: HistoryEntry) -> Assignacio:
        with self._sf.begin() as s:
            row = m.AssignacioRow(
                data_assignacio=assignacio.data,
                germa_id=assignacio.germa_id,
                modalitat_id=assignacio.modalitat_id,
                creat_per=assignacio.creat_per,
            )
            s.add(row)
            s.flush()
            s.add(
                m.HistorialRow(
                    assignacio_id=row.id,
                    data_assignacio=entry.data,
                    germa_id=entry.germa_id,
                    modalitat_id=entry.modalitat_id,
                    accio=entry.accio,
                    usuari_canvi=entry.usuari_id,
                    detalls_canvi=entry.detalls,
                )
            )
            self._touch(s)
            return self._assignacio(row)

    def remove(self, items: list[Assignacio], by: int | None, details: str) -> int:
        ids = [a.id for a in items if a.id is not None]
        if not ids:
            return 0
        with self._sf.begin() as s:
            for a in items:
                s.add(
                    m.HistorialRow(
                        assignacio_id=None,
                        data_assignacio=a.data,
                        germa_id=a.germa_id,
                        modalitat_id=a.modalitat_id,
                        accio="DELETE",
                        usuari_canvi=by,
                        detalls_canvi=details,
                    )
                )
            result = s.execute(delete(m.AssignacioRow).where(m.AssignacioRow.id.in_(ids)))
            self._touch(s)
            return result.rowcount

    def last_modification(self) -> LastModification | None:
        with self._sf() as s:
            state = s.get(m.CalendarStateRow, 1)
            if state is None:
                return None
            last = s.scalar(
                select(m.AssignacioRow).order_by(m.AssignacioRow.data_modificacio.desc())
            )
            germa = s.get(m.GermaRow, last.creat_per) if last and last.creat_per else None
            return LastModification(state.timestamp, germa.nom if germa else "Usuari")

    def history(self, limit: int) -> list[HistoryEntry]:
        with self._sf() as s:
            rows = s.scalars(
                select(m.HistorialRow)
                .order_by(m.HistorialRow.data_canvi.desc(), m.HistorialRow.id.desc())
                .limit(limit)
            )
            return [
                HistoryEntry(
                    r.accio,
                    r.data_assignacio,
                    r.germa_id,
                    r.modalitat_id,
                    r.assignacio_id,
                    r.usuari_canvi,
                    r.detalls_canvi,
                    r.id,
                    r.data_canvi,
                )  # fmt: skip
                for r in rows
            ]


class SqlInheritanceRepository:
    def __init__(self, sf: sessionmaker):
        self._sf = sf

    def fills(self) -> list[Fill]:
        with self._sf() as s:
            return [_to(Fill, r) for r in s.scalars(select(m.FillRow).order_by(m.FillRow.codi))]

    def fill(self, codi: int) -> Fill | None:
        with self._sf() as s:
            row = s.get(m.FillRow, codi)
            return _to(Fill, row) if row else None

    def finques(self) -> list[Finca]:
        with self._sf() as s:
            return [_to(Finca, r) for r in s.scalars(select(m.FincaRow).order_by(m.FincaRow.codi))]

    def pisos(self) -> list[Pis]:
        with self._sf() as s:
            return [_to(Pis, r) for r in s.scalars(select(m.PisRow).order_by(m.PisRow.codi))]

    def reassign_pis(self, pis_codi: int, fill_codi: int) -> bool:
        with self._sf.begin() as s:
            row = s.get(m.PisRow, pis_codi)
            if row is None:
                return False
            row.fill_codi = fill_codi
            return True

    def set_proposal(self, pis_codi: int, attr: str, fill_codi: int) -> bool:
        with self._sf.begin() as s:
            row = s.get(m.PisRow, pis_codi)
            if row is None:
                return False
            setattr(row, attr, fill_codi)
            return True

    def parametres(self, fill_codi: int) -> Parametres | None:
        with self._sf() as s:
            row = s.get(m.ParametresRow, fill_codi)
            return _to(Parametres, row) if row else None

    def save_parametres(self, p: Parametres) -> None:
        with self._sf.begin() as s:
            row = s.get(m.ParametresRow, p.fill_codi)
            if row is None:
                row = m.ParametresRow(fill_codi=p.fill_codi)
                s.add(row)
            row.vol, row.valor_vol, row.llivia, row.taxacio = (
                p.vol,
                p.valor_vol,
                p.llivia,
                p.taxacio,
            )

    def set_comentari(self, fill_codi: int, text: str) -> bool:
        with self._sf.begin() as s:
            row = s.get(m.FillRow, fill_codi)
            if row is None:
                return False
            row.comentari, row.dia_i_hora = text, datetime.now()
            return True

    def missatges(self) -> list[Missatge]:
        with self._sf() as s:
            rows = s.scalars(
                select(m.MissatgeRow).order_by(m.MissatgeRow.dia_i_hora, m.MissatgeRow.id)
            )
            return [_to(Missatge, r) for r in rows]

    def add_missatge(self, autor: str, text: str) -> None:
        with self._sf.begin() as s:
            s.add(m.MissatgeRow(autor=autor, text=text, dia_i_hora=datetime.now()))


class SqlSiteRepository:
    def __init__(self, sf: sessionmaker):
        self._sf = sf

    def list(self) -> list[Site]:
        with self._sf() as s:
            return [_to(Site, r) for r in s.scalars(select(m.SiteRow).order_by(m.SiteRow.name))]

    def get(self, site_id: int) -> Site | None:
        with self._sf() as s:
            row = s.get(m.SiteRow, site_id)
            return _to(Site, row) if row else None

    def save(self, site: Site) -> Site:
        with self._sf.begin() as s:
            row = s.get(m.SiteRow, site.id) if site.id else None
            if row is None:
                row = m.SiteRow()
                s.add(row)
            row.name, row.url, row.status, row.notes = site.name, site.url, site.status, site.notes
            s.flush()
            return _to(Site, row)

    def delete(self, site_id: int) -> bool:
        with self._sf.begin() as s:
            row = s.get(m.SiteRow, site_id)
            if row is None:
                return False
            s.delete(row)
            return True


class SqlAgentRepository:
    def __init__(self, sf: sessionmaker):
        self._sf = sf

    def list(self) -> list[Agent]:
        with self._sf() as s:
            return [_to(Agent, r) for r in s.scalars(select(m.AgentRow).order_by(m.AgentRow.name))]

    def get(self, agent_id: int) -> Agent | None:
        with self._sf() as s:
            row = s.get(m.AgentRow, agent_id)
            return _to(Agent, row) if row else None

    def save(self, agent: Agent) -> Agent:
        with self._sf.begin() as s:
            row = s.get(m.AgentRow, agent.id) if agent.id else None
            if row is None:
                row = m.AgentRow()
                s.add(row)
            row.name, row.kind, row.enabled = agent.name, agent.kind, agent.enabled
            row.site_id, row.config = agent.site_id, dict(agent.config)
            s.flush()
            return _to(Agent, row)

    def delete(self, agent_id: int) -> bool:
        with self._sf.begin() as s:
            row = s.get(m.AgentRow, agent_id)
            if row is None:
                return False
            s.delete(row)
            return True


class SqlAccessRepository:
    def __init__(self, sf: sessionmaker):
        self._sf = sf

    def get(self, user_id: int) -> Access:
        with self._sf() as s:
            sites = s.scalars(select(m.UserSiteRow.site_id).where(m.UserSiteRow.user_id == user_id))
            agents = s.execute(
                select(m.UserAgentRow.agent_id, m.UserAgentRow.can_work).where(
                    m.UserAgentRow.user_id == user_id
                )
            ).all()
            contents = s.scalars(
                select(m.UserContentRow.content_id).where(m.UserContentRow.user_id == user_id)
            )
            return Access(
                frozenset(sites),
                frozenset(a for a, _ in agents),
                frozenset(a for a, work in agents if work),
                frozenset(contents),
            )

    def set(self, user_id: int, access: Access) -> None:
        with self._sf.begin() as s:
            for row in (m.UserSiteRow, m.UserAgentRow, m.UserContentRow):
                s.execute(delete(row).where(row.user_id == user_id))
            s.add_all(m.UserSiteRow(user_id=user_id, site_id=i) for i in access.site_ids)
            s.add_all(
                m.UserAgentRow(user_id=user_id, agent_id=i, can_work=i in access.work_agent_ids)
                for i in access.agent_ids
            )
            s.add_all(m.UserContentRow(user_id=user_id, content_id=i) for i in access.content_ids)
