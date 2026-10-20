"""Punt d'entrada per a AWS Lambda darrere d'API Gateway (HTTP API) amb Mangum."""

from mangum import Mangum

from .adapters.web.app import create_app

_mangum = Mangum(create_app(), lifespan="off")


def handler(event, context):
    return _mangum(event, context)
