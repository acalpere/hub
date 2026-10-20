# acalpere — convencions de desenvolupament

- Arquitectura hexagonal. `domain` té entitats, regles i **ports**; `application` implementa casos d'ús només a través
  d'aquests ports. Cap de les dues capes no pot importar FastAPI, SQLAlchemy, boto3 ni altres adaptadors.
- Les consultes SQLAlchemy i les crides a SDK (SSM, Neon…) van a `adapters/persistence` o a un adaptador nou. Els routers
  (`adapters/web/routes`) validen, serialitzen i criden casos d'ús. El cablatge és només a `bootstrap.py`.
- Cada canvi d'esquema és una migració d'Alembic revisada, **additiva** (el desplegament migra abans de canviar el codi, i la
  versió anterior ha de continuar funcionant). Mai `create_all()` en producció.
- L'autenticació és pròpia (bcrypt, galeta de sessió `HttpOnly` signada). Les escriptures de `/api/` exigeixen la capçalera
  `X-Requested-With: acalpere` (CSRF). L'autorització es comprova al servidor a cada petició (`deps.py`), no al frontend.
- `shapes.py` conserva les claus JSON de l'aplicació antiga perquè `frontend/public/apps/*` (calendari i herència, portats tal
  com eren) segueixin funcionant. En portar una app a React, es neteja la forma i es treu d'allà.
- Dades personals i hashes (`data/legacy/`) mai al repositori. Cap secret al codi: SSM Parameter Store a AWS, `.env` en local.
- Abans de lliurar: `ruff check .`, `pytest`, `alembic check`; al frontend `npm run typecheck && npm test && npm run build`;
  per a infraestructura `terraform fmt -check -recursive terraform` i `terraform validate` a cada arrel.
- Producció: es desplega per GitHub Actions amb OIDC (`develop` → dev, `main` → prod). `terraform/dns` i `terraform/bootstrap` s'apliquen a mà.

## Regles de negoci (decisions del propietari; no canviar sense demanar-ho)

- **Calendari**: a casa de la mare només hi pot haver una persona al dia i llavors ningú més; al poble n'hi pot haver diverses,
  però no a casa si hi ha gent al poble. Un mateix germà no pot repetir-se el mateix dia al poble.
- **Herència**: només es poden escriure els camps `propostapere`, `propostajordi` i `propostarosamaria`.
- Tots els usuaris han d'iniciar sessió; `admin` veu a més «Webs i agents».
