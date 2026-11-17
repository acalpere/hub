from motfinal.adapters.definitions.wiktionary import (
    parse_catalan_senses,
    parse_catalan_synonyms,
)


def test_extracts_brief_catalan_senses_and_ignores_examples() -> None:
    text = """
== {{-ca-}} ==
=== Nom ===
# [[Conseqüència]] produïda arran d'un fet.
#: Un exemple que no és una accepció.
# {{marca|ca|literatura|cinema}} [[producte|Producte]] que continua una obra.
# Organització a l'empara de les {{w|ca|Constitucions catalanes}}.
=== Miscel·lània ===
* {{ca-sil}}
== {{-es-}} ==
# Definició en castellà.
"""

    assert parse_catalan_senses(text) == (
        "Conseqüència produïda arran d'un fet.",
        "(literatura, cinema) Producte que continua una obra.",
        "Organització a l'empara de les Constitucions catalanes.",
    )


def test_returns_no_senses_without_catalan_section() -> None:
    assert parse_catalan_senses("== {{-es-}} ==\n# Una definición.") == ()


def test_explains_and_deduplicates_conjugated_forms() -> None:
    text = """
== {{-ca-}} ==
=== Verb ===
# {{ca-forma-conj|belar|3|pres|ind}}
# {{ca-forma-conj|belar|2|imp}}
"""
    assert parse_catalan_senses(text) == ("Forma conjugada del verb «belar».",)


def test_extracts_only_synonyms_from_the_catalan_section() -> None:
    text = """
== {{-ca-}} ==
=== Nom ===
# Un edifici destinat a [[habitatge]].
{{-sin-}}
* [[edifici]], [[immoble]], [[casal]] (en parlar [[salat]])
* [[habitatge#Català|habitatge]], [[llar]]
{{-der-}}
* [[caseta]]
== {{-es-}} ==
{{-sin-}}
* [[hogar]]
"""

    assert parse_catalan_synonyms(text) == (
        "edifici",
        "immoble",
        "casal",
        "habitatge",
        "llar",
    )


def test_returns_no_synonyms_when_the_entry_has_no_synonym_section() -> None:
    assert parse_catalan_synonyms("== {{-ca-}} ==\n# Una definició.") == ()
