"""API del tutor d'AWS (només administradors, com la resta de la secció)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ....bootstrap import Container
from ....domain.identity import User
from .. import shapes
from ..deps import admin_user, container

router = APIRouter(prefix="/aws", tags=["aws"], dependencies=[Depends(admin_user)])


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(max_length=4000)


class AskIn(BaseModel):
    service: str = Field(default="", max_length=100)
    concept: str = Field(default="", max_length=600)
    level: str = Field(default="", max_length=20)
    question: str = Field(default="", max_length=2000)
    history: list[Turn] = Field(default_factory=list, max_length=40)


class ExplainIn(BaseModel):
    topic: str = Field(max_length=100)
    level: str = Field(max_length=20)


class QuizIn(ExplainIn):
    count: int = 5


@router.post("/explain")
def explain(body: ExplainIn, c: Container = Depends(container)):
    return {"answer": c.tutor.explain(body.topic, body.level)}


@router.post("/quiz")
def quiz(body: QuizIn, c: Container = Depends(container)):
    cards = c.tutor.quiz(body.topic, body.level, body.count)
    return {"cards": [{"question": q, "answer": a} for q, a in cards]}


@router.post("/tutor")
def ask(body: AskIn, c: Container = Depends(container)):
    history = [(t.role, t.text) for t in body.history]
    return {"answer": c.tutor.ask(body.service, body.concept, body.question, history, body.level)}


class NeedIn(BaseModel):
    name: str = Field(max_length=200)


@router.get("/needs")
def custom_needs(c: Container = Depends(container)):
    return [shapes.custom_need(n) for n in c.aws_notes.needs()]


@router.post("/needs", status_code=201)
def create_need(body: NeedIn, c: Container = Depends(container)):
    return shapes.custom_need(c.aws_notes.create_need(body.name))


@router.delete("/needs/{need_id}", status_code=204)
def delete_need(need_id: int, c: Container = Depends(container)):
    c.aws_notes.delete_need(need_id)


class MarkIn(BaseModel):
    key: str = Field(max_length=80)
    level: int


@router.get("/marks")
def marks(user: User = Depends(admin_user), c: Container = Depends(container)):
    return c.aws_notes.marks(user.id)


@router.put("/marks")
def set_mark(body: MarkIn, user: User = Depends(admin_user), c: Container = Depends(container)):
    c.aws_notes.set_mark(user.id, body.key, body.level)
    return c.aws_notes.marks(user.id)


class SavedIn(BaseModel):
    question: str = Field(max_length=2000)
    answer: str = Field(max_length=20000)


@router.get("/saved")
def saved(user: User = Depends(admin_user), c: Container = Depends(container)):
    return [shapes.saved_answer(a) for a in c.aws_notes.saved(user.id)]


@router.post("/saved", status_code=201)
def save_answer(body: SavedIn, user: User = Depends(admin_user), c: Container = Depends(container)):
    return shapes.saved_answer(c.aws_notes.save_answer(user.id, body.question, body.answer))


@router.delete("/saved/{saved_id}", status_code=204)
def delete_saved(
    saved_id: int, user: User = Depends(admin_user), c: Container = Depends(container)
):
    c.aws_notes.delete_saved(user.id, saved_id)
