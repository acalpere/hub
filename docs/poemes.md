# Poemes (paquet `motfinal`) dins d'acalpere

`poemes/` és una aplicació completa i independent (cercador de rimes, sinònims i editor de poemes). Aquí s'**incrusta**
com a paquet; res no la lliga al hub més enllà dels punts d'aquesta llista.

## Com està connectat

| Què | On |
| --- | --- |
| Paquet instal·lat amb el hub | `pyproject.toml` (`packages.find.where = ["src", "poemes/src"]`, `pyphen`) |
| API sota `/api/v1/poemes` (poemes, paraules, sinònims) | `src/acalpere/adapters/web/poemes.py` → `motfinal.adapters.web.api.build_router` |
| Autorització | `app_access("/apps/poemes/")`: entrada del menú (rol `admin` per defecte) |
| Sessions de BD | les del hub (`Container.session_factory`); motfinal no obre cap connexió pròpia |
| CSRF | el del hub (`X-Requested-With: acalpere`) |
| Taules `words` i `poems` | migració `0008`; `migrations/env.py` hi suma les metadades de motfinal |
| Interfície | `scripts/sync-poemes-ui.mjs` la copia a `frontend/public/apps/poemes/` (s'executa a `npm run dev` / `build`) |
| Context semàntic en producció | Bedrock (`SEMANTIC_PROVIDER=bedrock`, permís IAM a `terraform/modules/api`) |

## Posar-lo en marxa en local

```bash
alembic upgrade head                      # o arrencar el hub amb auto_migrate
motfinal import poemes/data/sample_words.txt     # lèxic (amb ACALPERE_DATABASE_URL del hub: vegeu nota)
acalpere seed-menu                        # afegeix «Poemes» al menú
```

Nota: `motfinal import` llegeix `DATABASE_URL`; per carregar el lèxic al hub, executeu-lo amb
`DATABASE_URL=<la mateixa URL que ACALPERE_DATABASE_URL>`. Per a un lèxic real, `motfinal import --hunspell ca.dic`.

## Separar-lo un dia

1. Moure `poemes/` a un repositori propi (ja té `pyproject.toml`, proves, Terraform i CI/CD propis). Allà funciona com
   una app independent: `motfinal.adapters.web.app` (contrasenya pròpia, interfície a `/`).
2. Al hub: treure `"poemes/src"` i `motfinal*` de `pyproject.toml`, afegir `motfinal` com a dependència (git/URL) o
   esborrar la integració; treure `mount_poemes` de `adapters/web/app.py`, `adapters/web/poemes.py`, l'import de
   `migrations/env.py` i el pas de `package.json`; i apuntar `POEMES_UI_DIR`/l'enllaç de menú al nou lloc.
3. Les taules `words` i `poems` es queden a la base de dades del hub (la 0008 no es toca) o es migren amb `pg_dump`.
