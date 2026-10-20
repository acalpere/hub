# PostgreSQL a Neon. Es fa servir el projecte `acalpere` que ja existeix (creat des de la consola):
#   - prod: la branca per defecte (`production`)
#   - dev:  una branca `dev` pròpia, còpia de `production` amb el seu endpoint, de manera que les
#           proves mai toquen les dades reals.
# Les cadenes de connexió es desen a SSM Parameter Store (SecureString, gratuït): una amb pooler
# per a l'app i una de directa per a les migracions d'Alembic.

terraform {
  required_providers {
    neon = { source = "kislerdm/neon" }
    aws  = { source = "hashicorp/aws" }
  }
}

data "neon_project" "db" {
  id = var.neon_project_id
}

resource "neon_branch" "env" {
  count      = var.create_branch ? 1 : 0
  project_id = data.neon_project.db.id
  parent_id  = data.neon_project.db.default_branch_id
  name       = var.env
}

resource "neon_endpoint" "env" {
  count                    = var.create_branch ? 1 : 0
  project_id               = data.neon_project.db.id
  branch_id                = neon_branch.env[0].id
  type                     = "read_write"
  autoscaling_limit_min_cu = 0.25
  autoscaling_limit_max_cu = 0.5
}

locals {
  host_direct = var.create_branch ? neon_endpoint.env[0].host : data.neon_project.db.database_host
  # Neon: el mateix endpoint amb "-pooler" al primer component és la connexió amb pooler.
  host_pooled = replace(local.host_direct, "/^([^.]+)/", "$1-pooler")

  url_template = "postgresql+psycopg://%s:%s@%%s/%s?sslmode=require"
  url_prefix = format(local.url_template, data.neon_project.db.database_user,
  urlencode(data.neon_project.db.database_password), data.neon_project.db.database_name)
  database_url          = format(local.url_prefix, local.host_pooled)
  database_url_unpooled = format(local.url_prefix, local.host_direct)
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
