from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from motfinal.adapters.linguistics.catalan import CatalanWordAnalyzer
from motfinal.adapters.persistence.models import Base
from motfinal.adapters.persistence.repository import SqlAlchemyWordRepository


def test_repository_persists_and_filters_words() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    analyzer = CatalanWordAnalyzer()
    with Session(engine) as session:
        repository = SqlAlchemyWordRepository(session)
        assert repository.add_many(
            [
                analyzer.analyze("cançó"),
                analyzer.analyze("casa"),
                analyzer.analyze("brasa"),
            ]
        ) == 3
        assert repository.add_many([analyzer.analyze("cançó")]) == 0

        words, total = repository.search("ço", 1, True, limit=10)
        assert total == 1
        assert words[0].text == "cançó"

        two_syllable_key = analyzer.analyze("casa").last_two_syllables_key
        assert two_syllable_key is not None
        words, total = repository.search(two_syllable_key, 2, False, limit=10)
        assert total == 2
        assert {word.text for word in words} == {"casa", "brasa"}
        assert [word.text for word in words] == ["casa", "brasa"]
