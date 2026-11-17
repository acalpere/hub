"""Router d'API injectable: el mateix codi serveix la mini-app sola i el hub acalpere.

Qui l'incrusta decideix tres coses (els tres paràmetres de `build_router`): d'on surten les
sessions de base de dades, quina comprovació d'accés exigeix i quins serveis fa servir.
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from motfinal.adapters.linguistics.catalan import CatalanWordAnalyzer
from motfinal.adapters.persistence.poem_repository import SqlAlchemyPoemRepository
from motfinal.adapters.persistence.repository import SqlAlchemyWordRepository
from motfinal.adapters.semantics.errors import SemanticModelUnavailable
from motfinal.adapters.web.schemas import (
    DefinitionsResponse,
    PoemInput,
    PoemResponse,
    SearchHitResponse,
    SearchQueryResponse,
    SearchResponse,
    SynonymsResponse,
    WordsInfoResponse,
)
from motfinal.application.poems import ManagePoems, PoemNotFound
from motfinal.application.search_words import InvalidSearch, SearchWords
from motfinal.bootstrap import Services
from motfinal.domain.models import Poem, SearchQuery, StressFilter
from motfinal.domain.text import is_valid_catalan_word

Dependency = Callable[..., object]


def build_router(
    services: Services,
    get_session: Callable[..., object],
    poems_access: Dependency,
    words_access: Dependency | None = None,
) -> APIRouter:
    settings = services.settings
    semantic_ranker = services.semantic_ranker
    definition_provider = services.definition_provider
    lookup_synonyms = services.lookup_synonyms
    describe_words = services.describe_words
    words_router = APIRouter(dependencies=[Depends(words_access)] if words_access else [])
    poems_router = APIRouter(dependencies=[Depends(poems_access)])

    @words_router.get("/words/search", response_model=SearchResponse)
    def search_words(
        *,
        word: Annotated[
            str, Query(min_length=1, max_length=160, description="Paraula de referència")
        ],
        syllable_count: Annotated[
            int, Query(ge=1, le=2, description="Nombre de síl·labes finals")
        ] = 1,
        stress: Annotated[
            StressFilter, Query(description="tonic, unstressed o any")
        ] = StressFilter.ANY,
        context: Annotated[str | None, Query(max_length=500)] = None,
        include_definitions: Annotated[
            bool, Query(description="Inclou les accepcions del Viccionari")
        ] = False,
        limit: Annotated[int, Query(ge=1, le=200)] = 50,
        offset: Annotated[int, Query(ge=0)] = 0,
        session: Annotated[Session, Depends(get_session)],
    ) -> SearchResponse:
        use_case = SearchWords(
            repository=SqlAlchemyWordRepository(session),
            analyzer=CatalanWordAnalyzer(),
            semantic_ranker=semantic_ranker,
            definition_provider=definition_provider,
            semantic_threshold=settings.semantic_threshold,
            semantic_relative_margin=settings.semantic_relative_margin,
            semantic_candidate_limit=settings.semantic_candidate_limit,
        )
        try:
            result = use_case.execute(
                SearchQuery(
                    word=word,
                    syllable_count=syllable_count,
                    stress=stress,
                    context=context,
                    include_definitions=include_definitions,
                    limit=limit,
                    offset=offset,
                )
            )
        except InvalidSearch as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except SemanticModelUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

        return SearchResponse(
            query=SearchQueryResponse(
                word=word,
                syllable_count=syllable_count,
                ending_syllables=list(result.ending_syllables),
                stress=stress.value,
                context=context,
                include_definitions=include_definitions,
                limit=limit,
                offset=offset,
            ),
            results=[
                SearchHitResponse(
                    word=hit.word.text,
                    syllables=list(hit.word.syllables),
                    final_syllable=hit.word.final_syllable,
                    final_stressed=hit.word.is_final_stressed,
                    stress_label="tònica" if hit.word.is_final_stressed else "àtona",
                    definitions=list(hit.definitions),
                    semantic_score=(
                        round(hit.semantic_score, 4) if hit.semantic_score is not None else None
                    ),
                )
                for hit in result.hits
            ],
            total=result.total,
            contextual=result.contextual,
            truncated_candidates=result.truncated_candidates,
        )


    @words_router.get("/words/synonyms", response_model=SynonymsResponse)
    def word_synonyms(
        word: Annotated[
            str, Query(min_length=1, max_length=160, description="Paraula catalana")
        ],
    ) -> SynonymsResponse:
        normalized = word.strip()
        if not is_valid_catalan_word(normalized):
            raise HTTPException(status_code=422, detail="Escriu una paraula catalana vàlida.")
        return SynonymsResponse(
            word=normalized,
            synonyms=list(lookup_synonyms.execute(normalized)),
        )


    @words_router.get("/words/info", response_model=WordsInfoResponse)
    def words_info(
        words: Annotated[
            str, Query(min_length=1, max_length=4000, description="Paraules separades per comes")
        ],
    ) -> WordsInfoResponse:
        unique = list(
            dict.fromkeys(w.strip() for w in words.split(",") if is_valid_catalan_word(w.strip()))
        )[:100]
        return WordsInfoResponse(words=describe_words.execute(unique))


    @words_router.get("/words/definitions", response_model=DefinitionsResponse)
    def word_definitions(
        word: Annotated[
            str, Query(min_length=1, max_length=160, description="Paraula catalana")
        ],
    ) -> DefinitionsResponse:
        normalized = word.strip()
        if not is_valid_catalan_word(normalized):
            raise HTTPException(status_code=422, detail="Escriu una paraula catalana vàlida.")
        definitions = definition_provider.get_many([normalized]).get(
            normalized.casefold(), ()
        )
        return DefinitionsResponse(word=normalized, definitions=list(definitions))





    def _poems(session: Annotated[Session, Depends(get_session)]) -> ManagePoems:
        return ManagePoems(SqlAlchemyPoemRepository(session))


    PoemsUseCase = Annotated[ManagePoems, Depends(_poems)]


    def _poem_response(poem: Poem) -> PoemResponse:
        return PoemResponse(**{name: getattr(poem, name) for name in PoemResponse.model_fields})


    @poems_router.get("/poems", response_model=list[PoemResponse])
    def list_poems(poems: PoemsUseCase) -> list[PoemResponse]:
        return [_poem_response(poem) for poem in poems.list()]


    @poems_router.post("/poems", response_model=PoemResponse, status_code=201)
    def create_poem(payload: PoemInput, poems: PoemsUseCase) -> PoemResponse:
        return _poem_response(poems.create(payload.title, payload.body, payload.status))


    @poems_router.get("/poems/{poem_id}", response_model=PoemResponse)
    def get_poem(poem_id: int, poems: PoemsUseCase) -> PoemResponse:
        try:
            return _poem_response(poems.get(poem_id))
        except PoemNotFound as exc:
            raise HTTPException(status_code=404, detail="Poema no trobat.") from exc


    @poems_router.put("/poems/{poem_id}", response_model=PoemResponse)
    def save_poem(poem_id: int, payload: PoemInput, poems: PoemsUseCase) -> PoemResponse:
        try:
            return _poem_response(poems.save(poem_id, payload.title, payload.body, payload.status))
        except PoemNotFound as exc:
            raise HTTPException(status_code=404, detail="Poema no trobat.") from exc


    @poems_router.delete("/poems/{poem_id}", status_code=204)
    def delete_poem(poem_id: int, poems: PoemsUseCase) -> None:
        try:
            poems.delete(poem_id)
        except PoemNotFound as exc:
            raise HTTPException(status_code=404, detail="Poema no trobat.") from exc



    router = APIRouter()
    router.include_router(words_router)
    router.include_router(poems_router)
    return router
