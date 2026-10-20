# PostgreSQL serverless a Neon: escala a zero en repòs. Les cadenes de connexió es desen a SSM
# Parameter Store (SecureString, gratuït): una amb pooler per a l'app i una de directa per a
# les migracions d'Alembic.

terraform {
  required_providers {
    neon = { source = "kislerdm/neon" }
    aws  = { source = "hashicorp/aws" }
  }
}

resource "neon_project" "this" {
  name                      = "acalpere-${var.env}"
  region_id                 = var.neon_region
  pg_version                = 17
  history_retention_seconds = 21600 # el pla gratuït limita l'historial a 6 hores
}

resource "neon_role" "app" {
  project_id = neon_project.this.id
  branch_id  = neon_project.this.default_branch_id
  name       = "acalpere_app"
}

resource "neon_database" "app" {
  project_id = neon_project.this.id
  branch_id  = neon_project.this.default_branch_id
  name       = "acalpere"
  owner_name = neon_role.app.name
}

locals {
  url_template = "postgresql+psycopg://%s:%s@%s/%s?sslmode=require"
  database_url = format(local.url_template, neon_role.app.name,
  neon_role.app.password, neon_project.this.database_host_pooler, neon_database.app.name)
  database_url_unpooled = format(local.url_template, neon_role.app.name,
  neon_role.app.password, neon_project.this.database_host, neon_database.app.name)
}

resource "aws_ssm_parameter" "database_url" {
  name  = "/acalpere/${var.env}/database_url"
  type  = "SecureString"
  value = local.database_url
}

resource "aws_ssm_parameter" "database_url_unpooled" {
  name  = "/acalpere/${var.env}/database_url_unpooled"
  type  = "SecureString"
  value = local.database_url_unpooled
}
