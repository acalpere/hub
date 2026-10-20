# Migració de la web antiga (DreamHost) a acalpere (AWS)

## Què era i què en queda

| Antic | Nou |
|---|---|
| `acalpere.cat` (portal PHP: `index.php`, `admin.php`, `germa.php`) | Shell React (accés, menú per rol, hub) + API `/api/v1/auth`, `/menu` |
| Calendari de la mare (Flask, `mare.acalpere.cat/Calendari`, MySQL `acp_calendari`) | `/apps/calendari/` (UI antiga portada) + API `/api/v1/calendar` |
| Simulador d'herència (Flask, `acalpere.cat/germans`, MySQL `acp_herencia`) | `/apps/herencia/` (UI antiga portada) + API `/api/v1/herencia` |
| MySQL `acalpere` (`usuaris`, `continguts`, `grups`) | `users` + `contents` (menú per rol) a Neon |
| `lalira`, `lalira-MVC` (PHP) | **Descartats** (decisió del propietari). No s'ha esborrat res de l'origen. |
| phpMyAdmin, `estructura/`, `public/aveure.php`, `passenger_wsgi.py`, `.htaccess` | Descartats |
| Correu (`Maildir`, MX de MailChannels/DreamHost) | **No es toca**: continua on és |

Les taules, els identificadors i els hashes de contrasenya es conserven (verificat: recomptes, sumes de control, longitud
de comentaris i xat, i hashes idèntics). Les contrasenyes dels usuaris **no canvien**.

Canvis visibles: l'URL del calendari passa de `/mare` a `/apps/calendari/`; l'herència ja no demana la contrasenya
compartida (estava escrita al JavaScript públic); ara tot requereix iniciar sessió (l'API antiga no tenia cap control d'accés).

## Dades

```bash
# 1. Bolcat (només llegeix). Cal poder arribar a web.acalpere.cat:3306
export LEGACY_DB_HOST=web.acalpere.cat LEGACY_DB_USER=... LEGACY_DB_PASSWORD=...
python scripts/dump_legacy_mysql.py            # -> data/legacy/ (ignorat per git)

# 2. Importació a una base buida (primer a dev). Tot o res: si falla, no queda res a mig.
export ACALPERE_DATABASE_URL_UNPOOLED=<neon dev, connexió directa> ACALPERE_DATABASE_URL=$ACALPERE_DATABASE_URL_UNPOOLED
acalpere import-legacy && acalpere seed-menu
```

Jordi i Rosa Maria són germans, no administradors (no veuen «Webs i agents»). A l'origen Jordi era `admin`, així que després
d'importar:

```bash
acalpere set-role Jordi germa
acalpere create-user "Rosa Maria" --role germa      # demana la contrasenya; passa-la-hi per un canal segur
```

Per a producció, el mateix amb `--replace` just en el moment del canvi (vegeu «Congelar» a sota).

## Canvi de DNS (OVH → Route 53)

`acalpere.cat` està registrat a **OVH** i el DNS també hi és (`dns10.ovh.ca`/`ns10.ovh.ca`), no a DreamHost. El pla és delegar
el DNS a Route 53 sense transferir el registre (es pot transferir més endavant, no cal ara).

**Abans de res:** exporta la zona d'OVH (Web Cloud → Dominis → `acalpere.cat` → Zona DNS → Exportar) i comprova que tots els
registres són a `terraform/dns/main.tf`. Els trobats amb `dig` són `web` (MySQL!), `mail`, `webmail`, `ftp`, `ssh`, `mare`,
`autoconfig`, `lalira` (CNAME d'un altre projecte), MX de MailChannels i SPF; **no es pot saber per `dig` si n'hi ha més**
(DKIM, DMARC, verificacions…). Un registre que falti deixarà de resoldre en el canvi.

1. 24 h abans: baixa el TTL de tots els registres a OVH a 300 s.
2. `cd terraform/dns && terraform init -backend-config="bucket=acalpere-tfstate-<compte>" && terraform apply`.
   Crea la zona i els registres. **No afecta res encara**: ningú hi apunta.
3. Comprova la zona contra OVH, registre a registre:
   `dig @<ns de Route 53> acalpere.cat MX` i el mateix per a cada nom, comparant amb `dig @dns10.ovh.ca …`.
4. Desplega prod **sense** domini (`use_custom_domain=false`) i prova la web a la URL de CloudFront (`web_url`).
5. **Congelar:** avisa que durant el canvi no s'editi el calendari ni l'herència. Torna a fer el bolcat i
   `acalpere import-legacy --replace` contra la Neon de producció. Entra amb cada usuari i comprova-ho.
6. A OVH, canvia els servidors de noms pels de l'output `name_servers` del pas 2. Propagació: minuts a unes hores.
   Mentrestant, la web vella segueix funcionant (la zona nova conté els mateixos registres).
7. Quan Route 53 ja respongui: `serve_web_from_aws=true` a `terraform/dns` (retira `@` i `www` cap a DreamHost) i tot seguit
   `use_custom_domain=true` a prod (certificat ACM, alies `acalpere.cat` i `www` a CloudFront). Hi ha un forat de segons/minuts
   entre els dos passos.
8. Comprova `https://acalpere.cat`, l'accés, el calendari i l'herència, i que el **correu** (enviar i rebre) continua anant.

**Tornada enrere** (mentre DreamHost segueixi actiu): a `terraform/dns` posa `serve_web_from_aws=false` i aplica: `@` i `www`
tornen a DreamHost en 5 minuts (Route 53 ja és l'autoritat). Si calgués desfer la delegació sencera, restaura els NS d'OVH.

## Després

- Manté DreamHost uns 30 dies. Cancel·la'l quan tot estigui validat. **Abans**, desa una còpia del bolcat (`data/legacy/`) en lloc segur.
- `mare.acalpere.cat` queda obsolet: es pot redirigir a `/apps/calendari/` o treure.
- `web.acalpere.cat` (el MySQL) deixa de tenir sentit quan es cancel·li DreamHost: retira'l de `terraform/dns`.

## Coses de seguretat de l'antiga web (a tractar)

- La contrasenya de MySQL era dins del codi (`germans/db/connection.py`) i el mateix usuari accedeix a les tres bases: **canvia-la
  a DreamHost** (o elimina l'usuari) un cop acabada la migració. El mateix amb qualsevol secret de `.bash_history`, `.mysql_history`.
- `phpMyAdmin` estava exposat a `acalpere.cat/phpmyadmin`.
- Calendari i herència no demanaven sessió: qualsevol podia llegir i modificar les dades si coneixia l'URL.
