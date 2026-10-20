# acalpere

Hub personal: **calendari de la mare**, **simulador d'herència** i, a mesura que creixi, la gestió centralitzada de les
meves webs i dels meus agents (màrqueting…). Substitueix la web antiga (PHP + jQuery + Flask a DreamHost) i en conserva
totes les aplicacions i dades.

- **API**: Python 3.12+, FastAPI, SQLAlchemy 2, Alembic, arquitectura hexagonal. Base de dades PostgreSQL a **Neon**.
- **Frontend**: React + Vite (menú, accés, hub). Les apps antigues (calendari, herència) viuen a `frontend/public/apps/`
  portades tal com eren, sobre l'API nova, mentre no es reescriguin en React.
- **Infraestructura** (Terraform): S3 + CloudFront (frontend) → `/api/*` → API Gateway (HTTP API) → Lambda; Route 53, ACM, SSM.
- **CI/CD**: GitHub Actions, desplegament per OIDC. `develop` → dev, `main` → prod.

```
src/acalpere/
├── domain/        entitats, regles (calendari, herència, hub, identitat) i ports
├── application/   casos d'ús
├── adapters/
│   ├── persistence/   SQLAlchemy (PostgreSQL a Neon; SQLite en local i proves)
│   └── web/           FastAPI: rutes, serialització, sessió i CSRF
├── bootstrap.py   arrel de composició
├── legacy_import.py  importa les dades de la web antiga
└── lambda_handler.py entrada per a AWS Lambda (Mangum)
frontend/          React + Vite · public/apps/ = calendari i herència antics
terraform/         bootstrap/ · dns/ · modules/ · envs/dev|prod
scripts/           build_lambda.sh · dump_legacy_mysql.py
```

## Posada en marxa local

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env              # sense ACALPERE_DATABASE_URL fa servir SQLite (acalpere.db)
acalpere migrate
acalpere create-user Pere         # demana la contrasenya
acalpere seed-menu                # entrades del menú
acalpere serve --port 8010        # API: http://localhost:8010/api/docs
```

En una altra terminal:

```bash
cd frontend && nvm use && npm ci
API_URL=http://localhost:8010 npm run dev     # http://localhost:5173
```

### Amb les dades reals de la web antiga

```bash
export LEGACY_DB_HOST=web.acalpere.cat LEGACY_DB_USER=... LEGACY_DB_PASSWORD=...
python scripts/dump_legacy_mysql.py           # escriu data/legacy/*.json (fora de git)
acalpere import-legacy                        # --replace per substituir el que hi hagi
acalpere seed-menu
```

Conserva els identificadors i els hashes de contrasenya (`$2y$` de PHP funciona tal qual). Les contrasenyes **no canvien**.

### Proves

```bash
ruff check . && pytest          # backend
cd frontend && npm run typecheck && npm test && npm run build
```

Per provar contra PostgreSQL: `ACALPERE_DATABASE_URL=postgresql://usuari:clau@host/db acalpere migrate`.

## API

`/api/v1` — tot requereix sessió (`POST /auth/login`) excepte `/api/health`. Les escriptures exigeixen
`X-Requested-With: acalpere`. Documentació interactiva a `/api/docs` només en local.

| Àrea | Rutes |
|---|---|
| Accés | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/password`, `GET /menu` |
| Usuaris (admin) | `GET/POST /users` |
| Calendari | `GET /calendar`, `POST /calendar/assignment`, `GET /calendar/stats\|history\|export`, `POST /calendar/import` |
| Herència | `/herencia/fills\|finques\|pisos\|repartiment\|parametres/{id}\|xat`, `POST /herencia/reassignar_pis\|guardar_proposta` |
| Hub (admin) | `/hub/sites`, `/hub/agents` (CRUD) |

## Desplegament

Vegeu [terraform/README.md](terraform/README.md) (ordre d'execució i secrets de GitHub) i
[docs/migracio.md](docs/migracio.md) (migració de dades i canvi de DNS, amb pla de tornada enrere).
