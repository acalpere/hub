"""Emmagatzematge del vídeo: bucket d'S3 privat a AWS (enllaços signats) o una carpeta en local."""

from __future__ import annotations

import logging
from pathlib import Path

log = logging.getLogger(__name__)

LOCAL_URL = "/api/v1/cyrano/video/file"
LINK_SECONDS = 4 * 3600  # cobreix una sessió de reproducció sencera (l'obra dura 2 h 34 min)


class LocalMediaStore:
    def __init__(self, directory: Path):
        self._dir = directory

    def local_file(self, name: str) -> Path | None:
        path = self._dir / name
        return path if path.is_file() else None

    def video_url(self, name: str) -> str | None:
        return LOCAL_URL if self.local_file(name) else None


class S3MediaStore:
    def __init__(self, bucket: str, region: str, client=None):
        self._bucket = bucket
        if client is None:
            import boto3
            from botocore.config import Config

            # Adreça virtual-hosted i firma v4: l'enllaç va directe a la regió del bucket.
            client = boto3.client(
                "s3",
                region_name=region,
                config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
            )
        self._s3 = client

    def local_file(self, name: str) -> Path | None:
        return None

    def video_url(self, name: str) -> str | None:
        try:
            self._s3.head_object(Bucket=self._bucket, Key=name)
        except (
            Exception
        ) as exc:  # botocore ClientError (no hi és: 404; sense permís: 403), de xarxa…
            # Encara no s'ha pujat, o no es pot llegir: el botó «Vídeo» simplement no surt.
            log.warning("Vídeo %s no disponible a %s: %s", name, self._bucket, exc)
            return None
        return self._s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self._bucket,
                "Key": name,
                "ResponseContentType": "video/mp4",
                "ResponseContentDisposition": "inline",
            },
            ExpiresIn=LINK_SECONDS,
        )
