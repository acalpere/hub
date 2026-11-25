from datetime import UTC, datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from motfinal.adapters.persistence.models import Base
from motfinal.adapters.persistence.poem_repository import SqlAlchemyPoemRepository
from motfinal.application.poems import ManagePoems
from motfinal.domain.models import PoemStatus


def test_poem_lifecycle_records_dates() -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    times = iter(datetime(2026, 11, 16, 10, tzinfo=UTC) + timedelta(hours=h) for h in range(10))
    with Session(engine) as session:
        poems = ManagePoems(SqlAlchemyPoemRepository(session), clock=lambda: next(times))
        poem = poems.create(" Mar ", "vers u\nvers dos", PoemStatus.IN_PROGRESS)
        assert poem.title == "Mar"
        assert poem.finished_at is None

        saved = poems.save(poem.id, "Mar", "vers u", PoemStatus.IN_PROGRESS)
        assert saved.status_changed_at == poem.status_changed_at
        assert saved.updated_at > poem.updated_at

        finished = poems.save(poem.id, "Mar", "vers u", PoemStatus.FINISHED)
        assert finished.finished_at == finished.status_changed_at
        assert finished.published_at is None

        published = poems.save(poem.id, "Mar", "vers u", PoemStatus.PUBLISHED)
        assert published.published_at is not None
        assert published.finished_at == finished.finished_at

        assert [p.id for p in poems.list()] == [poem.id]
        poems.delete(poem.id)
        assert poems.list() == []


def test_provisional_title_from_first_verse() -> None:
    from motfinal.application.poems import provisional_title

    assert provisional_title("\n  Com un mar de sal,\nsegon vers") == "Com un mar de sal"
    assert provisional_title("   \n") == "Sense títol"
    assert provisional_title("paraula " * 20).endswith("…")


def test_marked_verses_are_saved_and_kept() -> None:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        poems = ManagePoems(SqlAlchemyPoemRepository(session))
        poem = poems.create("Mar", "a\nb\nc", PoemStatus.IN_PROGRESS, (3, 1, 3))
        assert poem.marks == (1, 3)
        # sense indicar marques, es conserven; amb una llista buida, s'esborren
        assert poems.save(poem.id, "Mar", "a\nb\nc", PoemStatus.IN_PROGRESS).marks == (1, 3)
        assert poems.save(poem.id, "Mar", "a\nb\nc", PoemStatus.IN_PROGRESS, ()).marks == ()
