"""Exporta de manera reproduïble el lèxic validat de MotFinal a un text gzip."""

from __future__ import annotations

import argparse
import gzip
import io
import sqlite3
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    args = parser.parse_args()

    args.target.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(f"file:{args.source.resolve()}?mode=ro", uri=True) as database:
        with args.target.open("wb") as compressed:
            with gzip.GzipFile(fileobj=compressed, mode="wb", filename="", mtime=0) as archive:
                with io.TextIOWrapper(archive, encoding="utf-8", newline="\n") as output:
                    for (word,) in database.execute("SELECT text FROM words ORDER BY id"):
                        output.write(f"{word}\n")


if __name__ == "__main__":
    main()
