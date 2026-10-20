terraform {
  required_version = ">= 1.10"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 6.0" }
    neon   = { source = "kislerdm/neon", version = "~> 0.6" }
    random = { source = "hashicorp/random", version = "~> 3.6" }
  }
  # El bucket es passa a l'init: terraform init -backend-config="bucket=acalpere-tfstate-<compte>"
  backend "s3" {
    key          = "dev/terraform.tfstate"
    region       = "eu-west-1"
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = { Project = "acalpere", Environment = "dev", ManagedBy = "terraform" }
  }
}

# Llegeix la clau de NEON_API_KEY (secret de GitHub Actions o variable d'entorn local).
provider "neon" {}

# CloudFront només accepta certificats d'ACM de us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

module "database" {
  source          = "../../modules/neon_db"
  env             = "dev"
  neon_project_id = var.neon_project_id
  create_branch   = true
}

module "api" {
  source                 = "../../modules/api"
  env                    = "dev"
  package_path           = var.package_path
  database_url_ssm_param = module.database.database_url_ssm_param
  database_url_ssm_arn   = module.database.database_url_ssm_arn
  rp_id                  = var.use_custom_domain ? "dev.acalpere.cat" : ""
}

module "site" {
  source     = "../../modules/site"
  providers  = { aws.us_east_1 = aws.us_east_1 }
  env        = "dev"
  api_domain = module.api.api_domain
  # Buit fins al canvi de DNS (vegeu terraform/README.md): llavors la web només és a CloudFront.
  domain_names = var.use_custom_domain ? ["dev.acalpere.cat"] : []
}

module "budget" {
  source      = "../../modules/budget"
  env         = "dev"
  alert_email = var.alert_email
}
