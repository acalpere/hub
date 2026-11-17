import re
import unicodedata

_ACCENT_TRANSLATION = str.maketrans(
    {
        "à": "a",
        "á": "a",
        "è": "e",
        "é": "e",
        "í": "i",
        "ï": "i",
        "ò": "o",
        "ó": "o",
        "ú": "u",
        "ü": "u",
    }
)
_VALID_WORD = re.compile(r"^[a-zàáèéíïòóúüç·'’-]+$", re.IGNORECASE)
_VOWELS = frozenset("aàáeèéiíïoòóuúü")
_STRESSED_VOWELS = frozenset("àáèéíòóú")


def normalize_text(value: str) -> str:
    return unicodedata.normalize("NFC", value.strip().lower().replace("’", "'"))


def syllable_key(value: str) -> str:
    """Iguala accents gràfics, però conserva lletres pròpies com ç i l·l."""
    return normalize_text(value).translate(_ACCENT_TRANSLATION)


def syllable_ending_key(syllables: tuple[str, ...], count: int) -> str:
    """Clau poètica de les darreres `count` síl·labes.

    Amb dues síl·labes es prescindeix de l'atac consonàntic de la primera:
    «que·la» i «ve·la» comparteixen així la rima «e·la».
    """
    if count not in (1, 2) or len(syllables) < count:
        return ""
    selected = list(syllables[-count:])
    if count == 2:
        selected[0] = _rhyme_from_nucleus(selected[0])
    return "|".join(syllable_key(part) for part in selected)


def _rhyme_from_nucleus(syllable: str) -> str:
    value = normalize_text(syllable)
    accented = next(
        (index for index, letter in enumerate(value) if letter in _STRESSED_VOWELS),
        None,
    )
    if accented is not None:
        return value[accented:]
    for index, letter in enumerate(value):
        if letter not in _VOWELS:
            continue
        # La u de «que» és muda i la ü de «qüe» forma part de l'atac /kw/.
        if (
            letter in "uü"
            and index > 0
            and value[index - 1] in "qg"
            and index + 1 < len(value)
            and value[index + 1] in _VOWELS
        ):
            continue
        return value[index:]
    return value


def is_valid_catalan_word(value: str) -> bool:
    return bool(_VALID_WORD.fullmatch(normalize_text(value)))
