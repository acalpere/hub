"""Esquema SQLAlchemy. L'evolució és sempre per migracions d'Alembic (mai create_all)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# JSON a SQLite, JSONB a PostgreSQL
JsonType = JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    pass


def _now() -> datetime:
    return datetime.now().astimezone()


# --- identitat -----------------------------------------------------------------------------


class UserRow(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, server_default=func.now()
    )
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)


class PasskeyRow(Base):
    __tablename__ = "passkeys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    credential_id: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    public_key: Mapped[str] = mapped_column(Text, nullable=False)
    sign_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    label: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, server_default=func.now()
    )


# Els noms d'usuari són únics sense distingir majúscules (com a la web antiga).
Index("ux_users_username_lower", func.lower(UserRow.username), unique=True)


class ContentRow(Base):
    __tablename__ = "contents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    roles: Mapped[str] = mapped_column(String(80), nullable=False)  # "admin,germa"
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


# --- calendari -----------------------------------------------------------------------------


class GermaRow(Base):
    __tablename__ = "germans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nom: Mapped[str] = mapped_column(String(100), nullable=False)
    codi: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    color: Mapped[str] = mapped_column(String(7), nullable=False)
    actiu: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    data_creacio: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, server_default=func.now()
    )


class ModalitatRow(Base):
    __tablename__ = "modalitats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nom: Mapped[str] = mapped_column(String(50), nullable=False)
    codi: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    descripcio: Mapped[str | None] = mapped_column(Text)
    actiu: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    data_creacio: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, server_default=func.now()
    )


class AssignacioRow(Base):
    __tablename__ = "assignacions"
    __table_args__ = (
        UniqueConstraint("data_assignacio", "germa_id", "modalitat_id", name="unique_assignacio"),
        Index("idx_assignacions_data", "data_assignacio"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    data_assignacio: Mapped[date] = mapped_column(Date, nullable=False)
    germa_id: Mapped[int] = mapped_column(ForeignKey("germans.id", ondelete="CASCADE"))
    modalitat_id: Mapped[int] = mapped_column(ForeignKey("modalitats.id", ondelete="CASCADE"))
    creat_per: Mapped[int | None] = mapped_column(ForeignKey("germans.id", ondelete="SET NULL"))
    modificat_per: Mapped[int | None] = mapped_column(ForeignKey("germans.id", ondelete="SET NULL"))
    data_creacio: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, server_default=func.now()
    )
    data_modificacio: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_now,
        onupdate=_now,
        server_default=func.now(),
    )


class HistorialRow(Base):
    __tablename__ = "historial_canvis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    assignacio_id: Mapped[int | None] = mapped_column(
        ForeignKey("assignacions.id", ondelete="SET NULL")
    )
    data_assignacio: Mapped[date] = mapped_column(Date, nullable=False)
    germa_id: Mapped[int] = mapped_column(ForeignKey("germans.id", ondelete="CASCADE"))
    modalitat_id: Mapped[int] = mapped_column(ForeignKey("modalitats.id", ondelete="CASCADE"))
    accio: Mapped[str] = mapped_column(String(10), nullable=False)
    data_canvi: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, server_default=func.now()
    )
    usuari_canvi: Mapped[int | None] = mapped_column(ForeignKey("germans.id", ondelete="SET NULL"))
    detalls_canvi: Mapped[str | None] = mapped_column(Text)


class CalendarStateRow(Base):
    """Una sola fila (id = 1) amb el moment de l'últim canvi."""

    __tablename__ = "darrera_modificacio"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ConfiguracioRow(Base):
    __tablename__ = "configuracio"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clau: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    valor: Mapped[str | None] = mapped_column(Text)
    tipus: Mapped[str] = mapped_column(String(10), nullable=False, default="STRING")
    descripcio: Mapped[str | None] = mapped_column(Text)


# --- herència ------------------------------------------------------------------------------


class FillRow(Base):
    __tablename__ = "fills"
    # Dades sensibles xifrades (JSON); les columnes en clar queden en blanc un cop xifrades.
    dades: Mapped[str | None] = mapped_column(Text, nullable=True)

    codi: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nom: Mapped[str | None] = mapped_column(String(45))
    comentari: Mapped[str] = mapped_column(Text, nullable=False, default="")
    dia_i_hora: Mapped[datetime | None] = mapped_column(DateTime)


class FincaRow(Base):
    __tablename__ = "finques"
    # Dades sensibles xifrades (JSON); les columnes en clar queden en blanc un cop xifrades.
    dades: Mapped[str | None] = mapped_column(Text, nullable=True)

    codi: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nom: Mapped[str | None] = mapped_column(String(45))
    taxacio: Mapped[int | None] = mapped_column(Integer)
    comunitat: Mapped[int | None] = mapped_column(Integer)
    comunitat2: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class PisRow(Base):
    __tablename__ = "pisos"
    # Dades sensibles xifrades (JSON); les columnes en clar queden en blanc un cop xifrades.
    dades: Mapped[str | None] = mapped_column(Text, nullable=True)

    codi: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    finca_codi: Mapped[int | None] = mapped_column(ForeignKey("finques.codi"), index=True)
    # Qui té el pis és dada xifrada (a `dades`); aquí queda nul quan ja està xifrada.
    fill_codi: Mapped[int | None] = mapped_column(ForeignKey("fills.codi"), index=True)
    pis: Mapped[str | None] = mapped_column(String(20))
    porta: Mapped[str | None] = mapped_column(String(20))
    nom: Mapped[str] = mapped_column(String(40), nullable=False)
    taxacio: Mapped[int | None] = mapped_column(Integer)
    taxacio2: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rendiment: Mapped[int | None] = mapped_column(Integer)
    rendiment2: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    prorrateig: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    prorrateig2: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    actual: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    proposta_pere: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    proposta_jordi: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    proposta_rosamaria: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class ParametresRow(Base):
    # Sense clau forana: l'origen té una fila amb fill_codi 0 (valors per defecte).
    __tablename__ = "parametres"
    # Dades sensibles xifrades (JSON); les columnes en clar queden en blanc un cop xifrades.
    dades: Mapped[str | None] = mapped_column(Text, nullable=True)

    fill_codi: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    vol: Mapped[int] = mapped_column(Integer, nullable=False)
    valor_vol: Mapped[int] = mapped_column(Integer, nullable=False)
    llivia: Mapped[bool] = mapped_column(Boolean, nullable=False)
    taxacio: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class MissatgeRow(Base):
    __tablename__ = "missatges"
    # Dades sensibles xifrades (JSON); les columnes en clar queden en blanc un cop xifrades.
    dades: Mapped[str | None] = mapped_column(Text, nullable=True)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    autor: Mapped[str] = mapped_column(String(50), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    dia_i_hora: Mapped[datetime | None] = mapped_column(DateTime)


# --- hub -----------------------------------------------------------------------------------


class SiteRow(Base):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, server_default=func.now()
    )


class VerseRow(Base):
    __tablename__ = "verses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, server_default=func.now()
    )


class VerseSettingsRow(Base):
    __tablename__ = "verse_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    max_length: Mapped[int] = mapped_column(Integer, nullable=False)
    font_large: Mapped[float] = mapped_column(Float, nullable=False)
    font_small: Mapped[float] = mapped_column(Float, nullable=False)


class AwsNeedRow(Base):
    __tablename__ = "aws_needs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    tagline: Mapped[str] = mapped_column(Text, nullable=False)
    what: Mapped[str] = mapped_column(Text, nullable=False)
    services: Mapped[list] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, server_default=func.now()
    )


class AwsMarkRow(Base):
    __tablename__ = "aws_marks"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    level: Mapped[int] = mapped_column(Integer, nullable=False)


class AwsSavedRow(Base):
    __tablename__ = "aws_saved"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question: Mapped[str] = mapped_column(String(300), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, server_default=func.now()
    )


class AgentRow(Base):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id", ondelete="SET NULL"))
    config: Mapped[dict] = mapped_column(JsonType, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, server_default=func.now()
    )


class UserSiteRow(Base):
    """Webs que un usuari no administrador pot veure al Hub."""

    __tablename__ = "user_sites"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    site_id: Mapped[int] = mapped_column(
        ForeignKey("sites.id", ondelete="CASCADE"), primary_key=True
    )


class UserAgentRow(Base):
    """Agents que un usuari no administrador pot veure al Hub."""

    __tablename__ = "user_agents"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    agent_id: Mapped[int] = mapped_column(
        ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True
    )
    can_work: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )


class UserContentRow(Base):
    """Apps del menú principal autoritzades expressament a un usuari."""

    __tablename__ = "user_contents"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    content_id: Mapped[int] = mapped_column(
        ForeignKey("contents.id", ondelete="CASCADE"), primary_key=True
    )


# --- cyrano --------------------------------------------------------------------------------


class CyranoLineRow(Base):
    """Una línia del text de Cyrano: rèplica, acotació, títol o nota."""

    __tablename__ = "cyrano_lines"
    __table_args__ = (Index("ix_cyrano_lines_scene", "act", "scene", "position"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    act: Mapped[int] = mapped_column(Integer, nullable=False)
    scene: Mapped[int] = mapped_column(Integer, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    speaker: Mapped[str | None] = mapped_column(String(80))
    stamp: Mapped[str | None] = mapped_column(String(10))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    norm: Mapped[str] = mapped_column(Text, nullable=False)  # text sense accents, per cercar
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reviewed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )


class CyranoRevisionRow(Base):
    """Historial d'una línia: cada versió desada (la primera, el text original, sense autor)."""

    __tablename__ = "cyrano_revisions"
    __table_args__ = (Index("ix_cyrano_revisions_line", "line_id", "id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    line_id: Mapped[int] = mapped_column(
        ForeignKey("cyrano_lines.id", ondelete="CASCADE"), nullable=False
    )
    speaker: Mapped[str | None] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(10), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    stamp: Mapped[str | None] = mapped_column(String(10))
    edited_by: Mapped[str | None] = mapped_column(String(80))
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
