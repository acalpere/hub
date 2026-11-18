import pytest

from acalpere.domain.cyrano import fold, parse_transcript, roman, search_terms
from acalpere.domain.errors import InvalidInput

PARAGRAPHS = [
    "Cyrano de Bergerac — transcripció teatral",
    "Nota editorial",
    "",
    "ACTE I",
    "UNA REPRESENTACIÓ A L'HÔTEL DE BOURGOGNE",
    "ESCENA I",
    "EL BURGÈS — [00:03:01] Recordo que al meu temps.",
    "CYRANO (burleta)— «Hauahet?»",
    "Tots riuen",
    "«Pausa»",
    "ESCENA II",
    "LE BRET —Aquest pobre borratxo.",
    "Criteri editorial",
    "Les marques temporals remeten al vídeo original.",
]


def test_roman_numerals():
    assert [roman(x) for x in ("I", "IV", "IX", "XIV")] == [1, 4, 9, 14]


def test_fold_ignores_accents_case_and_typographic_apostrophe():
    assert fold("L’Hôtel de Bourgogne, ÇÀ") == "l'hotel de bourgogne, ca"


def test_search_terms_words_and_phrases():
    assert search_terms('Nas "pobre borratxo"') == ["nas", "pobre borratxo"]


def test_parse_transcript_structure():
    lines = parse_transcript(PARAGRAPHS)
    by_text = {line.text: line for line in lines}
    assert (lines[0].kind, lines[0].act) == ("title", 0)
    assert by_text["Nota editorial"].kind == "note"
    title = by_text["UNA REPRESENTACIÓ A L'HÔTEL DE BOURGOGNE"]
    assert (title.kind, title.act, title.scene) == ("title", 1, 0)
    burges = by_text["Recordo que al meu temps."]
    assert (burges.speaker, burges.stamp, burges.act, burges.scene) == (
        "EL BURGÈS",
        "00:03:01",
        1,
        1,
    )
    assert by_text["«Hauahet?»"].speaker == "CYRANO (burleta)"
    assert by_text["Tots riuen"].kind == "stage"
    assert by_text["Aquest pobre borratxo."].scene == 2
    criteri = by_text["Les marques temporals remeten al vídeo original."]
    assert (criteri.act, criteri.scene, criteri.kind) == (0, 1, "note")
    assert [line.position for line in lines] == list(range(len(lines)))


def test_cyrano_api(client, container, admin):
    n = container.cyrano.import_transcript(PARAGRAPHS)
    assert n == len(parse_transcript(PARAGRAPHS))

    outline = admin.get("/api/v1/cyrano/outline").json()
    assert outline["acts"][1] == {
        "act": 1,
        "title": "UNA REPRESENTACIÓ A L'HÔTEL DE BOURGOGNE",
        "scenes": [1, 2],
    }
    assert {s["name"] for s in outline["speakers"]} == {"EL BURGÈS", "CYRANO", "LE BRET"}

    whole = admin.get("/api/v1/cyrano/text").json()
    assert len(whole) == n and whole[0]["act"] == 0 and whole[-1]["act"] == 0
    scene = admin.get("/api/v1/cyrano/scenes/1/1").json()
    assert [x["kind"] for x in scene] == ["speech", "speech", "stage", "stage"]

    found = admin.get("/api/v1/cyrano/search", params={"q": "BORRATXÓ"}).json()["results"]
    assert [x["text"] for x in found] == ["Aquest pobre borratxo."]
    by_speaker = admin.get("/api/v1/cyrano/search", params={"speaker": "cyrano (x)"})
    assert [x["text"] for x in by_speaker.json()["results"]] == ["«Hauahet?»"]
    assert admin.get("/api/v1/cyrano/search", params={"q": ""}).json()["results"] == []

    line = found[0]
    edited = admin.put(
        f"/api/v1/cyrano/lines/{line['id']}",
        json={"speaker": "LE BRET", "kind": "speech", "text": "Aquest pobre poeta."},
    )
    assert edited.status_code == 200
    assert admin.get("/api/v1/cyrano/search", params={"q": "borratxo"}).json()["results"] == []
    assert len(admin.get("/api/v1/cyrano/search", params={"q": "poeta"}).json()["results"]) == 1


def test_cyrano_history_and_restore(client, container, admin):
    container.cyrano.import_transcript(PARAGRAPHS)
    line = admin.get("/api/v1/cyrano/search", params={"q": "borratxo"}).json()["results"][0]
    url = f"/api/v1/cyrano/lines/{line['id']}"
    assert admin.get(url + "/history").json() == []

    for text in ("Aquest pobre poeta.", "Aquest pobre savi."):
        body = {"speaker": "LE BRET", "kind": "speech", "text": text}
        assert admin.put(url, json=body).status_code == 200

    versions = admin.get(url + "/history").json()
    assert [v["text"] for v in versions] == [
        "Aquest pobre savi.",
        "Aquest pobre poeta.",
        "Aquest pobre borratxo.",
    ]
    assert [v["edited_by"] for v in versions] == ["Pere", "Pere", None]  # l'última: l'original

    restored = admin.post(url + "/restore", json={"revision_id": versions[2]["id"]})
    assert restored.json()["text"] == "Aquest pobre borratxo."
    after = admin.get(url + "/history").json()
    assert len(after) == 4 and after[0]["text"] == "Aquest pobre borratxo."  # res s'esborra
    assert len(admin.get("/api/v1/cyrano/search", params={"q": "borratxo"}).json()["results"]) == 1

    other = admin.get("/api/v1/cyrano/scenes/1/1").json()[0]["id"]
    wrong = admin.post(
        f"/api/v1/cyrano/lines/{other}/restore", json={"revision_id": versions[0]["id"]}
    )
    assert wrong.status_code == 404


def test_cyrano_import_protects_edits(client, container, admin):
    container.cyrano.import_transcript(PARAGRAPHS)
    line_id = admin.get("/api/v1/cyrano/scenes/1/1").json()[0]["id"]
    admin.put(
        f"/api/v1/cyrano/lines/{line_id}", json={"speaker": "X", "kind": "speech", "text": "a"}
    )
    with pytest.raises(InvalidInput, match="--force"):
        container.cyrano.import_transcript(PARAGRAPHS)
    assert container.cyrano.import_transcript(PARAGRAPHS, force=True) > 0
    assert admin.get(f"/api/v1/cyrano/lines/{line_id}/history").json() == []


def test_cyrano_edit_validation(client, container, admin):
    container.cyrano.import_transcript(PARAGRAPHS)
    line_id = admin.get("/api/v1/cyrano/scenes/1/1").json()[0]["id"]
    url = f"/api/v1/cyrano/lines/{line_id}"
    assert admin.put(url, json={"speaker": "X", "kind": "title", "text": "a"}).status_code == 400
    assert admin.put(url, json={"speaker": "X", "kind": "speech", "text": " "}).status_code == 400
    assert admin.put(url, json={"speaker": "", "kind": "speech", "text": "a"}).status_code == 400
    assert (
        admin.put("/api/v1/cyrano/lines/99999", json={"kind": "stage", "text": "a"}).status_code
        == 404
    )


def test_cyrano_requires_access_and_only_admin_edits(client, container, germa):
    container.cyrano.import_transcript(PARAGRAPHS)
    assert client.get("/api/v1/cyrano/outline").status_code == 403


def test_export_round_trips_through_odt(tmp_path, client, container, admin):
    from acalpere.adapters.odt import read_paragraphs, write_paragraphs
    from acalpere.domain.cyrano import to_transcript

    container.cyrano.import_transcript(PARAGRAPHS)
    line = admin.get("/api/v1/cyrano/scenes/1/1").json()[0]
    admin.put(
        f"/api/v1/cyrano/lines/{line['id']}",
        json={"speaker": "EL BURGÈS", "kind": "speech", "text": "Text <editat> & «nou»."},
    )

    path = tmp_path / "cyrano.odt"
    write_paragraphs(path, container.cyrano.export_transcript())
    again = parse_transcript(read_paragraphs(path))
    current = container.cyrano.export_lines()
    key = lambda ln: (ln.act, ln.scene, ln.kind, ln.speaker, ln.stamp, ln.text)  # noqa: E731
    assert [key(x) for x in again] == [key(x) for x in current]
    assert any(x.text == "Text <editat> & «nou»." for x in again)
    assert to_transcript(parse_transcript(PARAGRAPHS))[0].startswith("Cyrano de Bergerac")


def test_cyrano_pdf_download(client, container, admin):
    container.cyrano.import_transcript(PARAGRAPHS)
    r = admin.get("/api/v1/cyrano/pdf")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert "attachment" in r.headers["content-disposition"]
    assert r.content.startswith(b"%PDF-1.4") and r.content.rstrip().endswith(b"%%EOF")


def test_cyrano_pdf_requires_access(client, container, germa):
    assert client.get("/api/v1/cyrano/pdf").status_code == 403


def test_cyrano_video_local(client, container, admin, tmp_path):
    from acalpere.adapters.media import LocalMediaStore

    assert admin.get("/api/v1/cyrano/video").json() == {"available": False, "url": None}
    assert admin.get("/api/v1/cyrano/video/file").status_code == 404

    (tmp_path / "cyrano.mp4").write_bytes(bytes(range(256)) * 4)
    container.cyrano._media = LocalMediaStore(tmp_path)
    assert admin.get("/api/v1/cyrano/video").json() == {
        "available": True,
        "url": "/api/v1/cyrano/video/file",
    }
    whole = admin.get("/api/v1/cyrano/video/file")
    assert whole.status_code == 200 and len(whole.content) == 1024
    part = admin.get("/api/v1/cyrano/video/file", headers={"Range": "bytes=10-19"})
    assert part.status_code == 206 and part.content == bytes(range(10, 20))


def test_cyrano_video_requires_access(client, container, germa):
    assert client.get("/api/v1/cyrano/video").status_code == 403
    assert client.get("/api/v1/cyrano/video/file").status_code == 403


def test_s3_media_store_signs_only_existing_files():
    from acalpere.adapters.media import LINK_SECONDS, S3MediaStore

    class NotFound(Exception):  # com el ClientError de botocore, que el CI no instal·la
        pass

    class FakeS3:
        def __init__(self, exists):
            self.exists, self.signed = exists, None

        def head_object(self, Bucket, Key):  # noqa: N803
            if not self.exists:
                raise NotFound("404 HeadObject")

        def generate_presigned_url(self, op, Params, ExpiresIn):  # noqa: N803
            self.signed = (op, Params, ExpiresIn)
            return "https://bucket.s3.amazonaws.com/cyrano.mp4?X-Amz-Signature=x"

    missing = S3MediaStore("b", "eu-west-1", client=FakeS3(False))
    assert missing.video_url("cyrano.mp4") is None
    fake = FakeS3(True)
    store = S3MediaStore("b", "eu-west-1", client=fake)
    assert store.video_url("cyrano.mp4").startswith("https://")
    assert fake.signed[0] == "get_object" and fake.signed[1]["Key"] == "cyrano.mp4"
    assert fake.signed[2] == LINK_SECONDS and store.local_file("cyrano.mp4") is None


def test_cyrano_edit_stamp(client, container, admin):
    container.cyrano.import_transcript(PARAGRAPHS)
    line = admin.get("/api/v1/cyrano/scenes/1/2").json()[0]
    assert line["stamp"] is None
    url = f"/api/v1/cyrano/lines/{line['id']}"
    body = {"speaker": "LE BRET", "kind": "speech", "text": line["text"], "stamp": "0:12:05"}
    assert admin.put(url, json=body).json()["stamp"] == "00:12:05"
    assert admin.get("/api/v1/cyrano/scenes/1/2").json()[0]["stamp"] == "00:12:05"
    assert admin.put(url, json={**body, "stamp": "12:5"}).status_code == 400
    assert admin.put(url, json={**body, "stamp": "00:99:00"}).status_code == 400
    assert admin.put(url, json={**body, "stamp": ""}).json()["stamp"] is None
    history = admin.get(url + "/history").json()
    assert [v["stamp"] for v in history] == [None, "00:12:05", None]
    admin.post(url + "/restore", json={"revision_id": history[1]["id"]})
    assert admin.get("/api/v1/cyrano/scenes/1/2").json()[0]["stamp"] == "00:12:05"
