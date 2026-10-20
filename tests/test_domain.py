from datetime import date

import pytest

from acalpere.domain.calendar import Assignacio, Modalitat, check_can_add
from acalpere.domain.errors import Conflict
from acalpere.domain.inheritance import Fill, Pis, repartiment

MODS = {1: Modalitat(1, "Poble", "poble"), 2: Modalitat(2, "Casa", "casa")}
D = date(2026, 1, 1)


def a(germa, mod):
    return Assignacio(None, D, germa, mod)


def test_empty_day_allows_anything():
    check_can_add([], MODS, 1, 1)
    check_can_add([], MODS, 1, 2)


def test_several_brothers_can_be_in_poble():
    check_can_add([a(1, 1)], MODS, 2, 1)
    check_can_add([a(1, 1), a(2, 1)], MODS, 3, 1)


def test_exact_duplicate_is_rejected():
    with pytest.raises(Conflict, match="ja existeix"):
        check_can_add([a(1, 1)], MODS, 1, 1)


def test_nobody_else_when_someone_is_at_casa():
    with pytest.raises(Conflict, match="algú a casa"):
        check_can_add([a(1, 2)], MODS, 2, 1)
    with pytest.raises(Conflict, match="algú a casa"):
        check_can_add([a(1, 2)], MODS, 2, 2)


def test_casa_not_allowed_with_people_in_poble():
    with pytest.raises(Conflict, match="gent al poble"):
        check_can_add([a(1, 1)], MODS, 2, 2)


def test_repartiment_sums_per_son_and_treats_null_as_zero():
    fills = [Fill(1, "Pere"), Fill(2, "Jordi")]
    pisos = [
        Pis(1, 1, 1, "A", taxacio=100, rendiment=10),
        Pis(2, 1, 1, "B", taxacio=None, rendiment=5),
    ]
    assert repartiment(fills, pisos) == {
        1: {"nom": "Pere", "patrimoni": 100, "rendiment": 15},
        2: {"nom": "Jordi", "patrimoni": 0, "rendiment": 0},
    }
