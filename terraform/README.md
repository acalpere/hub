# Infraestructura d'acalpere (Terraform)

```
bootstrap/   Un sol cop, amb credencials d'administrador: bucket d'estat remot + rols IAM (OIDC de GitHub) per a dev i prod.
dns/         Zona de Route 53 d'acalpere.cat i els registres actuals. S'aplica a mà; perdura encara que s'esborrin els entorns.
modules/
  neon_db/   Usa el projecte `acalpere` de Neon (prod = branca `production`; dev = branca `dev`) + cadenes de connexió (pooler i directa) a SSM.
  api/       Lambda (FastAPI + Mangum) + API Gateway HTTP API amb throttling + secret de sessió a SSM.
  site/      S3 privat + CloudFront (OAC) amb /api/* cap a l'API Gateway; domini propi: ACM (us-east-1) + alias a Route 53.
  budget/    Pressupost mensual amb avís per correu.
envs/dev, envs/prod   Composició dels mòduls amb estat remot separat.
```

## Ordre

1. `cd bootstrap && terraform init && terraform apply` (crea `acalpere-tfstate-<compte>` i els rols `acalpere-github-deploy-dev|prod`).
2. Al repositori `acalpere/hub` → **Settings → Secrets and variables → Actions**:
   - Secrets: `AWS_ROLE_ARN_DEV`, `AWS_ROLE_ARN_PROD` (sortides del bootstrap), `NEON_API_KEY` (consola de Neon → Account settings → API keys).
   - Variables: `ALERT_EMAIL` (acalpere@gmail.com), `TFSTATE_BUCKET` (`acalpere-tfstate-989571801339`), i (més tard) `USE_CUSTOM_DOMAIN=true`.
   - **Environments**: crea `dev` i `prod`; a `prod` afegeix-hi aprovació manual.
3. Push a `develop` (→ dev) o `main` (→ prod). El flux: base de dades → migracions → infraestructura i codi → frontend → comprovació.
4. `terraform/dns` i el canvi de servidors de noms a OVH: seguint [../docs/migracio.md](../docs/migracio.md).

Primer desplegament local (si prefereixes no esperar el CI):

```bash
bash scripts/build_lambda.sh
cd terraform/envs/dev && export NEON_API_KEY=...
terraform init -backend-config="bucket=acalpere-tfstate-<compte>"
terraform apply -var alert_email=acalpere@gmail.com
```

## Cost estimat

Neon (pla gratuït, escala a zero), Lambda i API Gateway (nivell gratuït), S3/CloudFront/SSM (cèntims), Route 53 (0,50 $/mes per zona).
El pressupost mensual avisa als 50 %, 80 % i 100 % de 10 $.
