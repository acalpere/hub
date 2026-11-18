"""Implementacions SQLAlchemy dels ports de repositori."""

from __future__ import annotations

import json
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
from ...domain.cyrano import Line, Revision
from ...domain.hub import Access, Agent, Site
from ...domain.identity import Content, Passkey, Profile, User
from ...domain.inheritance import Fill, Finca, Missatge, Parametres, Pis
from ...domain.ports import Cipher
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


# Camps d'herència que es desen xifrats (a `dades`). Només queden en clar els codis (claus
# primàries sense significat) i les claus foranes de `parametres`.
_SEALED = {
    m.FillRow: ("nom", "comentari", "dia_i_hora"),
    m.FincaRow: ("nom", "taxacio", "comunitat", "comunitat2"),
    m.PisRow: (
        "fill_codi", "finca_codi", "pis", "porta", "nom", "taxacio", "taxacio2", "rendiment",
        "rendiment2", "prorrateig", "prorrateig2", "actual", "proposta_pere", "proposta_jordi",
        "proposta_rosamaria",
    ),
    m.ParametresRow: ("vol", "valor_vol", "llivia", "taxacio"),
    m.MissatgeRow: ("autor", "text", "dia_i_hora"),
}  # fmt: skip


def _blank(column):
    """Valor neutre per a una columna en clar ja xifrada (les NOT NULL no poden quedar a nul)."""
    if column.nullable:
        return None
    return {"Integer": 0, "Boolean": False}.get(type(column.type).__name__, "")


class _Sealed:
    """Lectura i escriptura transparents de les dades xifrades d'una fila d'herència."""

    def __init__(self, cipher: Cipher):
        self._cipher = cipher

    def data(self, row) -> dict:
        fields_ = _SEALED[type(row)]
        if row.dades:
            context = type(row).__tablename__
            return json.loads(self._cipher.decrypt(row.dades, context))
        return {f: getattr(row, f) for f in fields_}  # encara sense xifrar (abans de seal_all)

    def load(self, cls, row):
        values = {f.name: getattr(row, f.name) for f in fields(cls)}
        values.update(self.data(row))
        if isinstance(values.get("dia_i_hora"), str):
            values["dia_i_hora"] = datetime.fromisoformat(values["dia_i_hora"])
        return cls(**values)

    def save(self, row, **changes) -> None:
        data = self.data(row) | changes
        text = json.dumps(data, default=lambda o: o.isoformat())
        row.dades = self._cipher.encrypt(text, type(row).__tablename__)
        for name in _SEALED[type(row)]:
            setattr(row, name, _blank(type(row).__table__.c[name]))


class SqlInheritanceRepository:
    def __init__(self, sf: sessionmaker, cipher: Cipher):
        self._sf = sf
        self._sealed = _Sealed(cipher)

    def fills(self) -> list[Fill]:
        with self._sf() as s:
            rows = s.scalars(select(m.FillRow).order_by(m.FillRow.codi))
            return [self._sealed.load(Fill, r) for r in rows]

    def fill(self, codi: int) -> Fill | None:
        with self._sf() as s:
            row = s.get(m.FillRow, codi)
            return self._sealed.load(Fill, row) if row else None

    def finques(self) -> list[Finca]:
        with self._sf() as s:
            rows = s.scalars(select(m.FincaRow).order_by(m.FincaRow.codi))
            return [self._sealed.load(Finca, r) for r in rows]

    def pisos(self) -> list[Pis]:
        with self._sf() as s:
            rows = s.scalars(select(m.PisRow).order_by(m.PisRow.codi))
            return [self._sealed.load(Pis, r) for r in rows]

    def reassign_pis(self, pis_codi: int, fill_codi: int) -> bool:
        with self._sf.begin() as s:
            row = s.get(m.PisRow, pis_codi)
            if row is None:
                return False
            self._sealed.save(row, fill_codi=fill_codi)
            return True

    def set_proposal(self, pis_codi: int, attr: str, fill_codi: int) -> bool:
        with self._sf.begin() as s:
            row = s.get(m.PisRow, pis_codi)
            if row is None:
                return False
            self._sealed.save(row, **{attr: fill_codi})
            return True

    def parametres(self, fill_codi: int) -> Parametres | None:
        with self._sf() as s:
            row = s.get(m.ParametresRow, fill_codi)
            return self._sealed.load(Parametres, row) if row else None

    def save_parametres(self, p: Parametres) -> None:
        with self._sf.begin() as s:
            row = s.get(m.ParametresRow, p.fill_codi)
            if row is None:
                row = m.ParametresRow(fill_codi=p.fill_codi)
                s.add(row)
            self._sealed.save(
                row, vol=p.vol, valor_vol=p.valor_vol, llivia=p.llivia, taxacio=p.taxacio
            )

    def set_comentari(self, fill_codi: int, text: str) -> bool:
        with self._sf.begin() as s:
            row = s.get(m.FillRow, fill_codi)
            if row is None:
                return False
            self._sealed.save(row, comentari=text, dia_i_hora=datetime.now())
            return True

    def missatges(self) -> list[Missatge]:
        with self._sf() as s:
            rows = s.scalars(select(m.MissatgeRow).order_by(m.MissatgeRow.id))
            # La data és xifrada: l'ordre cronològic es fa aquí, no a SQL.
            messages = [self._sealed.load(Missatge, r) for r in rows]
            return sorted(messages, key=lambda x: (x.dia_i_hora or datetime.min, x.id or 0))

    def add_missatge(self, autor: str, text: str) -> None:
        with self._sf.begin() as s:
            row = m.MissatgeRow()
            self._sealed.save(row, autor=autor, text=text, dia_i_hora=datetime.now())
            s.add(row)

    def seal_all(self) -> int:
        """Xifra les files encara en clar (migració de dades i importacions). Idempotent."""
        done = 0
        with self._sf.begin() as s:
            for model in _SEALED:
                for row in s.scalars(select(model).where(model.dades.is_(None))):
                    self._sealed.save(row)
                    done += 1
        return done


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


class SqlCyranoRepository:
    def __init__(self, sf: sessionmaker):
        self._sf = sf

    @staticmethod
    def _line(r: m.CyranoLineRow) -> Line:
        return Line(r.id, r.act, r.scene, r.position, r.kind, r.speaker, r.stamp, r.text)

    def sections(self) -> list[tuple[int, int]]:
        with self._sf() as s:
            rows = s.execute(
                select(m.CyranoLineRow.act, m.CyranoLineRow.scene)
                .distinct()
                .order_by(m.CyranoLineRow.act, m.CyranoLineRow.scene)
            )
            return [(a, sc) for a, sc in rows]

    def all_lines(self) -> list[Line]:
        with self._sf() as s:
            rows = s.scalars(select(m.CyranoLineRow).order_by(m.CyranoLineRow.position))
            return [self._line(r) for r in rows]

    def titles(self) -> list[Line]:
        with self._sf() as s:
            rows = s.scalars(
                select(m.CyranoLineRow)
                .where(m.CyranoLineRow.kind == "title", m.CyranoLineRow.scene == 0)
                .order_by(m.CyranoLineRow.position)
            )
            return [self._line(r) for r in rows]

    def scene(self, act: int, scene: int) -> list[Line]:
        with self._sf() as s:
            rows = s.scalars(
                select(m.CyranoLineRow)
                .where(m.CyranoLineRow.act == act, m.CyranoLineRow.scene == scene)
                .order_by(m.CyranoLineRow.position)
            )
            return [self._line(r) for r in rows]

    def speakers(self) -> list[tuple[str, int]]:
        with self._sf() as s:
            rows = s.execute(
                select(m.CyranoLineRow.speaker, func.count())
                .where(m.CyranoLineRow.speaker.is_not(None))
                .group_by(m.CyranoLineRow.speaker)
            )
            return [(name, n) for name, n in rows]

    def search(self, terms: list[str], speaker: str | None, limit: int) -> list[Line]:
        query = select(m.CyranoLineRow).where(m.CyranoLineRow.act > 0)
        for term in terms:
            query = query.where(m.CyranoLineRow.norm.contains(term, autoescape=True))
        if speaker:
            query = query.where(m.CyranoLineRow.speaker.istartswith(speaker, autoescape=True))
        with self._sf() as s:
            rows = s.scalars(query.order_by(m.CyranoLineRow.position).limit(limit))
            return [self._line(r) for r in rows]

    def update(
        self,
        line_id: int,
        speaker: str | None,
        kind: str,
        text: str,
        norm: str,
        stamp: str | None,
        by: str,
    ) -> Line | None:
        with self._sf.begin() as s:
            row = s.get(m.CyranoLineRow, line_id)
            if row is None:
                return None
            if not s.scalar(
                select(func.count())
                .select_from(m.CyranoRevisionRow)
                .where(m.CyranoRevisionRow.line_id == line_id)
            ):  # primera edició: es conserva el text original
                s.add(
                    m.CyranoRevisionRow(
                        line_id=line_id,
                        speaker=row.speaker,
                        kind=row.kind,
                        text=row.text,
                        stamp=row.stamp,
                    )
                )
            now = _now()
            row.speaker, row.kind, row.text, row.norm, row.stamp, row.updated_at = (
                speaker,
                kind,
                text,
                norm,
                stamp,
                now,
            )
            s.add(
                m.CyranoRevisionRow(
                    line_id=line_id,
                    speaker=speaker,
                    kind=kind,
                    text=text,
                    stamp=stamp,
                    edited_by=by,
                    edited_at=now,
                )
            )
            s.flush()
            return self._line(row)

    @staticmethod
    def _revision(r: m.CyranoRevisionRow) -> Revision:
        return Revision(
            r.id, r.line_id, r.speaker, r.kind, r.text, r.stamp, r.edited_by, r.edited_at
        )

    def history(self, line_id: int) -> list[Revision]:
        with self._sf() as s:
            rows = s.scalars(
                select(m.CyranoRevisionRow)
                .where(m.CyranoRevisionRow.line_id == line_id)
                .order_by(m.CyranoRevisionRow.id.desc())
            )
            return [self._revision(r) for r in rows]

    def revision(self, revision_id: int) -> Revision | None:
        with self._sf() as s:
            row = s.get(m.CyranoRevisionRow, revision_id)
            return self._revision(row) if row else None

    def edited_count(self) -> int:
        with self._sf() as s:
            return (
                s.scalar(
                    select(func.count())
                    .select_from(m.CyranoLineRow)
                    .where(m.CyranoLineRow.updated_at.is_not(None))
                )
                or 0
            )

    def replace_all(self, lines: list[Line], norms: list[str]) -> int:
        with self._sf.begin() as s:
            s.execute(delete(m.CyranoRevisionRow))
            s.execute(delete(m.CyranoLineRow))
            s.add_all(
                m.CyranoLineRow(
                    act=ln.act,
                    scene=ln.scene,
                    position=ln.position,
                    kind=ln.kind,
                    speaker=ln.speaker,
                    stamp=ln.stamp,
                    text=ln.text,
                    norm=norm,
                )
                for ln, norm in zip(lines, norms, strict=True)
            )
        return len(lines)
