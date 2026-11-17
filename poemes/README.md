# MotFinal

MotFinal és una aplicació web per trobar paraules catalanes que acaben en una síl·laba determinada. Permet distingir si la síl·laba final és tònica o àtona i, opcionalment, ordenar i filtrar els resultats segons un context semàntic escrit amb llenguatge natural.

Exemples:

- `ció` + **tònica** → `acció`, `ficció`, `emoció`…
- `sa` + **àtona** → `casa`, `brasa`…
- `ar` + context «mar, sal, costa i navegació» → prioritza els mots més pròxims a aquest entorn.

## Què inclou

- Interfície web responsive en català.
- API REST amb documentació OpenAPI a `/docs`.
- Cerca exacta per darrera síl·laba; la consulta admet escriure-la amb o sense accent.
- Filtres de síl·laba final tònica, àtona o indiferent.
- Context semàntic opcional: E5 multilingüe en local i Cohere Embed Multilingual
  mitjançant Amazon Bedrock en producció.
- Les cerques contextuals prioritzen mots documentats i incorporen les accepcions
  del Viccionari al rànquing semàntic.
- Definicions i sinònims del Viccionari, consultables individualment en un diàleg.
- Resultats responsius en tres, dues o una columna, amb modes «Llista» i «Lligat».
- Canvi de visualització de totes les definicions sense haver de tornar a prémer cerca.
- Importador de llistes simples i diccionaris Hunspell.
- PostgreSQL a Neon, SQLAlchemy 2 i migracions Alembic.
- Desplegament en contenidor a AWS App Runner, imatges a ECR i secrets a Secrets Manager.
- Terraform separat en *bootstrap* i aplicació.
- CI/CD amb GitHub Actions i autenticació AWS OIDC, sense claus AWS permanents.

## Arquitectura hexagonal

```text
Navegador / API / CLI
        │
        ▼
  Casos d'ús ─────────────── SearchWords / ImportWords
        │
        ▼
Ports del nucli ──────────── WordRepository / WordAnalyzer / SemanticRanker
        │
        ├── SQLAlchemy ───── Neon PostgreSQL
        ├── Pyphen ───────── partició i regles d'accentuació catalanes
        └── SemanticRanker
             ├── E5 multilingüe amb CPU ─ desenvolupament local
             └── Amazon Bedrock/Cohere ── producció a AWS
```

El directori `domain` no depèn de FastAPI, SQLAlchemy ni AWS. Els adaptadors es poden substituir sense canviar les regles de cerca.

## Execució local ràpida

Cal Python 3.12.

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev,semantic,bedrock]'
cp .env.example .env
```

Per fer una prova sense Neon, substitueix temporalment les dues URL de `.env` per:

```dotenv
DATABASE_URL=sqlite:///./motfinal.db
DATABASE_URL_UNPOOLED=sqlite:///./motfinal.db
```

Després:

```bash
alembic upgrade head
motfinal import data/sample_words.txt
uvicorn motfinal.main:app --reload --port 8080
```

Obre `http://127.0.0.1:8080`. La primera cerca amb context descarrega el model semàntic local i l'executa sempre amb CPU. Aquest port permet executar alhora l'API local d'`acalpere`.

## Neon

1. Crea un projecte PostgreSQL a Neon.
2. Copia la URL **pooled** a `DATABASE_URL`. El nom del host sol contenir `-pooler`.
3. Copia la URL **directa** a `DATABASE_URL_UNPOOLED`. Alembic i les importacions massives fan servir aquesta connexió.
4. Executa `alembic upgrade head`.

Per carregar el lèxic català complet a Ubuntu/Debian:

```bash
sudo apt-get install hunspell-ca hunspell-tools
unmunch /usr/share/hunspell/ca_ES.dic /usr/share/hunspell/ca_ES.aff > /tmp/mots-ca.txt
motfinal import /tmp/mots-ca.txt
```

La importació és idempotent: els mots ja existents no es dupliquen. El pipeline de producció només fa aquesta càrrega si detecta menys de 1.000 entrades.

El lèxic català validat es distribueix comprimit a `data/catalan-words.txt.gz` perquè
els entorns local i de producció treballin amb el mateix conjunt de mots. Deriva del
diccionari català de Softcatalà i manté la seva llicència dual LGPL 2.1 / GPL 2;
l'atribució i els enllaços a les llicències són a `data/SOFTCATALA-DICTIONARY-LICENSE.md`.

## API

```http
GET /api/v1/words/search?word=emoció&syllable_count=1&stress=tonic
GET /api/v1/words/search?word=navegar&syllable_count=1&stress=any&context=mar%20i%20navegació
GET /api/v1/words/definitions?word=esquela
GET /api/v1/words/synonyms?word=amor
```

Valors de `stress`:

- `any`: qualsevol tonicitat.
- `tonic`: la síl·laba final és tònica.
- `unstressed`: la síl·laba final és àtona.

Sense context, `total` és el recompte exhaustiu i es pot paginar amb `limit` i `offset`.
Les definicions no s'envien per defecte; s'activen amb `include_definitions=true`.
La interfície permet consultar definicions i sinònims individuals en un diàleg petit.
Quan s'activen totes les definicions, l'enllaç individual de definició s'oculta.
Amb context, s'avaluen fins a `SEMANTIC_CANDIDATE_LIMIT` coincidències. Cada accepció
del Viccionari es converteix en un vector independent, es calcula la similitud cosinus
amb el vector del context, desambiguat amb les accepcions de la paraula de referència,
i cada paraula conserva la millor de les seves accepcions.
Finalment s'apliquen el llindar absolut `SEMANTIC_THRESHOLD` i un marge respecte del
millor resultat (`SEMANTIC_RELATIVE_MARGIN`). És una afinitat aproximada: els contextos
curts o ambigus discriminen pitjor que una frase amb diverses idees concretes. Aquesta
afinitat s'utilitza internament per filtrar, però no es presenta com un percentatge a
la interfície perquè no és una probabilitat.

## Proves i qualitat

```bash
python -m pip install -e '.[dev]'
ruff check .
pytest --cov=motfinal
terraform fmt -check -recursive terraform
```

## AWS i CI/CD

### 1. Bootstrap únic des d'un ordinador amb accés AWS

```bash
cd terraform/bootstrap
terraform init
terraform apply
terraform output
```

Això crea el bucket xifrat per a l'estat de Terraform i el rol OIDC restringit al branch `main` de `acalpere/poemes`.

### 2. Configuració del repositori GitHub

Variables d'Actions (`Settings → Secrets and variables → Actions → Variables`):

| Variable | Valor |
|---|---|
| `AWS_REGION` | `eu-west-1` o la regió del bootstrap |
| `AWS_ROLE_ARN` | sortida `github_actions_role_arn` |
| `TF_STATE_BUCKET` | sortida `terraform_state_bucket` |

Secrets d'Actions:

| Secret | Valor |
|---|---|
| `DATABASE_URL` | URL **pooled** de Neon |
| `DATABASE_URL_UNPOOLED` | URL **directa** de Neon |

### 3. Desplegament

Cada `push` a `main`:

1. executa Ruff i pytest;
2. prepara ECR i Secrets Manager amb Terraform;
3. construeix una imatge immutable identificada pel SHA del commit;
4. publica la imatge a ECR;
5. actualitza el secret de connexió agrupada;
6. executa Alembic i inicialitza el lèxic si cal;
7. aplica Terraform i actualitza App Runner.

App Runner té sortida pública a Internet per connectar-se amb Neon i Bedrock, i injecta
`DATABASE_URL` des de Secrets Manager. En producció Terraform configura
`SEMANTIC_PROVIDER=bedrock`, el model `cohere.embed-multilingual-v3` a `eu-west-1` i un
permís IAM limitat a `bedrock:InvokeModel` per a aquest model. No cal cap clau AWS dins
del contenidor: App Runner utilitza el seu rol d'instància.

Abans del primer desplegament, cal comprovar a la consola d'Amazon Bedrock que el model
**Cohere Embed Multilingual** està disponible per al compte a la regió triada. Les
peticions es facturen a través d'AWS Marketplace. El contenidor de producció no inclou
PyTorch ni el model local, de manera que és sensiblement més petit.

Després de canviar manualment el valor d'un secret, cal un nou desplegament perquè
App Runner el torni a carregar.

Terraform associa també el servei amb `https://poemes.acalpere.cat` i crea a Route 53 el CNAME del servei i els registres de validació del certificat d'App Runner.

## Decisions i límits lingüístics

- La separació és ortogràfica i es basa en els patrons catalans de Pyphen.
- Un accent gràfic determina la síl·laba tònica. Sense accent, s'apliquen les regles generals del català i una llista curta de monosíl·labs funcionals àtons.
- Hi pot haver excepcions prosòdiques, variants dialectals o particions discutibles. Per això l'aplicació mostra sempre les síl·labes calculades.
- El filtre semàntic és una mesura d'afinitat, no una definició lexicogràfica. El llindar és configurable.

## Fonts tècniques

- [Connexions agrupades a Neon](https://neon.com/docs/connect/connection-pooling)
- [Secrets com a variables d'App Runner](https://docs.aws.amazon.com/apprunner/latest/dg/env-variable.html)
- [Cohere Embed Multilingual a Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-cohere-embed-multilingual.html)
- [Paràmetres de Cohere Embed v3](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-embed-v3.html)
- [Diccionaris catalans de Softcatalà](https://github.com/Softcatala/catalan-dict-tools)
- [Model multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small)
