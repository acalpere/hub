"""Importa a la base de dades nova les dades de la web antiga (MySQL a DreamHost).

Llegeix els volcats JSON de data/legacy/ (vegeu scripts/dump_legacy_mysql.py). Conserva els
identificadors originals, de manera que res no es renumera.
"""

from __future__ import annotations

import json
from datetime import UTC, date, datetime
from pathlib import Path

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import sessionmaker

from .adapters.persistence import models as m


def _dt(value: str | None, tz: bool = True) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(value)
    # Les marques de temps d'MySQL no duien zona; les tractem com a UTC.
    return parsed.replace(tzinfo=UTC) if tz and parsed.tzinfo is None else parsed


def _load(directory: Path, name: str) -> dict[str, list[dict]]:
    return json.loads((directory / f"{name}.data.json").read_text(encoding="utf-8"))


# (model, taula d'origen, funció fila d'origen -> kwargs). Ordre = ordre de dependències.
def _plan(acalpere, herencia, calendari):
    return [
        (m.UserRow, [
            dict(id=r["codi"], username=r["usuari"], password_hash=r["clau"], role=r["tipus"],
                 created_at=_dt(r["creat_el"]) or datetime.now(UTC))
            for r in acalpere["usuaris"]
        ]),
        (m.GermaRow, [
            dict(id=r["id"], nom=r["nom"], codi=r["codi"], color=r["color"], actiu=bool(r["actiu"]),
                 data_creacio=_dt(r["data_creacio"]))
            for r in calendari["germans"]
        ]),
        (m.ModalitatRow, [
            dict(id=r["id"], nom=r["nom"], codi=r["codi"], descripcio=r["descripcio"],
                 actiu=bool(r["actiu"]), data_creacio=_dt(r["data_creacio"]))
            for r in calendari["modalitats"]
        ]),
        (m.ConfiguracioRow, [
            dict(id=r["id"], clau=r["clau"], valor=r["valor"], tipus=r["tipus"],
                 descripcio=r["descripcio"])
            for r in calendari["configuracio"]
        ]),
        (m.AssignacioRow, [
            dict(id=r["id"], data_assignacio=date.fromisoformat(r["data_assignacio"]),
                 germa_id=r["germa_id"], modalitat_id=r["modalitat_id"], creat_per=r["creat_per"],
                 modificat_per=r["modificat_per"], data_creacio=_dt(r["data_creacio"]),
                 data_modificacio=_dt(r["data_modificacio"]))
            for r in calendari["assignacions"]
        ]),
        (m.HistorialRow, [
            dict(id=r["id"], assignacio_id=r["assignacio_id"],
                 data_assignacio=date.fromisoformat(r["data_assignacio"]), germa_id=r["germa_id"],
                 modalitat_id=r["modalitat_id"], accio=r["accio"], data_canvi=_dt(r["data_canvi"]),
                 usuari_canvi=r["usuari_canvi"], detalls_canvi=r["detalls_canvi"])
            for r in calendari["historial_canvis"]
        ]),
        (m.CalendarStateRow, [
            dict(id=r["id"], timestamp=_dt(r["timestamp"]))
            for r in calendari["darrera_modificacio"]
        ]),
        (m.FillRow, [
            dict(codi=r["codi"], nom=r["nom"], comentari=r["comentari"] or "",
                 dia_i_hora=_dt(r["diaIHora"], tz=False))
            for r in herencia["Fills"]
        ]),
        (m.FincaRow, [
            dict(codi=r["codi"], nom=r["nom"], taxacio=r["taxacio"], comunitat=r["comunitat"],
                 comunitat2=r["comunitat2"])
            for r in herencia["Finques"]
        ]),
        (m.PisRow, [
            dict(codi=r["codi"], finca_codi=r["Finques_codi"], fill_codi=r["Fills_codi"],
                 pis=r["pis"], porta=r["porta"], nom=r["nom"], taxacio=r["taxacio"],
                 taxacio2=r["taxacio2"], rendiment=r["rendiment"], rendiment2=r["rendiment2"],
                 prorrateig=r["prorrateig"], prorrateig2=r["prorrateig2"], actual=r["actual"],
                 proposta_pere=r["propostapere"], proposta_jordi=r["propostajordi"],
                 proposta_rosamaria=r["propostarosamaria"])
            for r in herencia["Pisos"]
        ]),
        (m.ParametresRow, [
            dict(fill_codi=r["codiFill"], vol=r["vol"], valor_vol=r["valorVol"],
                 llivia=bool(r["llivia"]), taxacio=int(r["taxacio"]))
            for r in herencia["Parametres"]
        ]),
        (m.MissatgeRow, [
            dict(id=r["id"], autor=r["autor"], text=r["text"],
                 dia_i_hora=_dt(r["diaIHora"], tz=False))
            for r in herencia["Missatges"]
        ]),
    ]  # fmt: skip


def import_legacy(sf: sessionmaker, directory: Path, replace: bool = False) -> dict[str, int]:
    """Importa tot i retorna les files carregades per taula. Tot o res (una transacció)."""
    plan = _plan(
        _load(directory, "acalpere"),
        _load(directory, "acp_herencia"),
        _load(directory, "acp_calendari"),
    )
    with sf.begin() as s:
        occupied = [
            model.__tablename__
            for model, _ in plan
            if s.scalar(select(func.count()).select_from(model))
        ]
        if occupied and not replace:
            raise RuntimeError(
                f"Les taules {', '.join(occupied)} ja tenen dades. "
                "Fes servir --replace per substituir-les."
            )
        for model, _ in reversed(plan):
            s.execute(delete(model))
        counts = {}
        for model, rows in plan:
            s.add_all(model(**r) for r in rows)
            s.flush()  # sense relationship(), l'ordre de dependències el posem nosaltres
            counts[model.__tablename__] = len(rows)
        if s.bind.dialect.name == "postgresql":
            _reset_sequences(s, [(mod, "id") for mod, _ in plan if hasattr(mod, "id")])
            _reset_sequences(s, [(m.FillRow, "codi"), (m.FincaRow, "codi"), (m.PisRow, "codi")])
    return counts


def _reset_sequences(s, targets) -> None:
    """Després d'inserir id explícits, la seqüència de PostgreSQL s'ha de posar al màxim."""
    for model, col in targets:
        if model is m.CalendarStateRow:
            continue
        table = model.__tablename__
        s.execute(
            text(
                f"SELECT setval(pg_get_serial_sequence('{table}', '{col}'), "
                f"COALESCE((SELECT MAX({col}) FROM {table}), 1))"
            )
        )
