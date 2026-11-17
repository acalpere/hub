.PHONY: install test lint migrate seed run

install:
	python -m pip install -e '.[dev,semantic,bedrock]'

test:
	pytest

lint:
	ruff check .

migrate:
	alembic upgrade head

seed:
	motfinal import data/sample_words.txt

run:
	uvicorn motfinal.main:app --reload --port 8080
