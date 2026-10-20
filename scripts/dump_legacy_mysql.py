#!/usr/bin/env python3
"""Bolca les tres bases de la web antiga (MySQL) a data/legacy/*.json. Només llegeix.

Ús (les credencials per variables d'entorn, mai en fitxers del repositori):

    export LEGACY_DB_HOST=web.acalpere.cat LEGACY_DB_USER=... LEGACY_DB_PASSWORD=...
    pip install mysql-connector-python   # (extra "dev")
    python scripts/dump_legacy_mysql.py
"""

import datetime
import decimal
import json
import os
import sys
from pathlib import Path

import mysql.connector

DATABASES = ("acalpere", "acp_herencia", "acp_calendari")
OUT = Path(__file__).resolve().parent.parent / "data" / "legacy"


def _json(value):
    if isinstance(value, datetime.datetime | datetime.date | datetime.time):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, bytes | bytearray):
        return value.decode("utf8", "replace")
    if isinstance(value, datetime.timedelta):
        return str(value)
    raise TypeError(type(value))


def main() -> int:
    try:
        keys = ("LEGACY_DB_HOST", "LEGACY_DB_USER", "LEGACY_DB_PASSWORD")
        host, user, password = (os.environ[k] for k in keys)
    except KeyError as e:
        print(f"Falta la variable d'entorn {e}", file=sys.stderr)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    for db in DATABASES:
        conn = mysql.connector.connect(host=host, user=user, password=password, database=db)
        cur = conn.cursor(dictionary=True)
        cur.execute("SHOW FULL TABLES")
        tables, ddl, data = [], [], {}
        for row in cur.fetchall():
            name, kind = list(row.values())[:2]
            cur.execute(f"SHOW CREATE {'VIEW' if kind == 'VIEW' else 'TABLE'} `{name}`")
            ddl.append(list(cur.fetchone().values())[1] + ";")
            if kind != "VIEW":
                cur.execute(f"SELECT * FROM `{name}`")
                data[name] = cur.fetchall()
                tables.append(name)
        (OUT / f"{db}.schema.sql").write_text("\n\n".join(ddl), encoding="utf-8")
        path = OUT / f"{db}.data.json"
        text = json.dumps(data, default=_json, ensure_ascii=False, indent=1)
        path.write_text(text, encoding="utf-8")
        path.chmod(0o600)  # conté hashes de contrasenyes i converses
        print(db, {t: len(data[t]) for t in tables})
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
