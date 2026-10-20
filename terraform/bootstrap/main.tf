# S'aplica una sola vegada amb credencials d'administrador. Crea el que necessiten els entorns
# per desplegar-se des de GitHub Actions sense claus permanents: el bucket d'estat de Terraform
# i els rols IAM (OIDC) de dev i prod.

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags { tags = { Project = "acalpere", ManagedBy = "terraform", Component = "bootstrap" } }
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "tfstate" {
  bucket = "acalpere-tfstate-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# AWS només permet un proveïdor OIDC de GitHub per compte i ja existeix (el comparteixen tots
# els projectes), així que es reutilitza en lloc de crear-lo.
data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

locals {
  # GitHub afegeix també els ID numèrics al subject del token (repo:propietari@ID/repo@ID:...).
  # Es consenten tots dos formats; amb l'ID, un repositori que es quedés el nom no podria assumir el rol.
  repo_subjects = compact([
    var.github_repo,
    var.github_owner_id != "" && var.github_repo_id != "" ? "${split("/", var.github_repo)[0]}@${var.github_owner_id}/${split("/", var.github_repo)[1]}@${var.github_repo_id}" : "",
  ])

  # dev es desplega des de develop; prod només des de main i amb l'entorn protegit de GitHub.
  environments = {
    dev = flatten([for r in local.repo_subjects : [
      "repo:${r}:ref:refs/heads/develop", "repo:${r}:environment:dev"
    ]])
    prod = [for r in local.repo_subjects : "repo:${r}:environment:prod"]
  }
}

data "aws_iam_policy_document" "assume" {
  for_each = local.environments
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = each.value
    }
  }
}

resource "aws_iam_role" "deploy" {
  for_each           = local.environments
  name               = "acalpere-github-deploy-${each.key}"
  assume_role_policy = data.aws_iam_policy_document.assume[each.key].json
}

# Permisos acotats als recursos amb prefix "acalpere-<entorn>-". La zona de Route 53 (terraform/dns)
# NO la pot esborrar ni crear el desplegament: només hi afegeix registres.
data "aws_iam_policy_document" "deploy" {
  for_each = local.environments
  statement {
    sid = "ManageAcalpereResources"
    actions = [
      "s3:*", "lambda:*", "ssm:*", "logs:*", "budgets:*", "cloudwatch:*",
      "iam:GetRole", "iam:PassRole", "iam:CreateRole", "iam:DeleteRole", "iam:TagRole",
      "iam:PutRolePolicy", "iam:GetRolePolicy", "iam:DeleteRolePolicy", "iam:AttachRolePolicy",
      "iam:DetachRolePolicy", "iam:ListRolePolicies", "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole", "iam:ListRoleTags", "iam:UntagRole",
      "iam:UpdateAssumeRolePolicy", "iam:UpdateRole",
    ]
    resources = [
      "arn:aws:s3:::acalpere-${each.key}-*", "arn:aws:s3:::acalpere-${each.key}-*/*",
      "arn:aws:lambda:*:*:function:acalpere-${each.key}-*",
      "arn:aws:ssm:*:*:parameter/acalpere/${each.key}/*",
      "arn:aws:logs:*:*:log-group:/aws/lambda/acalpere-${each.key}-*",
      "arn:aws:logs:*:*:log-group:/aws/lambda/acalpere-${each.key}-*:*",
      "arn:aws:logs:*:*:log-group:/aws/apigateway/acalpere-${each.key}",
      "arn:aws:logs:*:*:log-group:/aws/apigateway/acalpere-${each.key}:*",
      "arn:aws:iam::*:role/acalpere-${each.key}-*",
      "arn:aws:budgets::*:budget/acalpere-${each.key}*",
    ]
  }
  statement {
    sid       = "ApiGateway"
    actions   = ["apigateway:*"]
    resources = ["arn:aws:apigateway:*::/apis", "arn:aws:apigateway:*::/apis/*", "arn:aws:apigateway:*::/tags/*"]
  }
  # CloudFront, ACM i Route 53 no admeten ARN predictibles per prefix: s'acoten per servei.
  statement {
    sid       = "CdnCertificatesAndRecords"
    actions   = ["cloudfront:*", "acm:*", "route53:ChangeResourceRecordSets", "route53:Get*", "route53:List*"]
    resources = ["*"]
  }
  statement {
    sid       = "TerraformState"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
    resources = [aws_s3_bucket.tfstate.arn, "${aws_s3_bucket.tfstate.arn}/${each.key}/*"]
  }
  statement {
    sid = "ReadOnlyDescribe"
    actions = ["logs:DescribeLogGroups", "lambda:GetAccountSettings", "budgets:ViewBudget",
    "ssm:DescribeParameters", "lambda:ListFunctions", "iam:ListRoles", "sts:GetCallerIdentity"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "deploy" {
  for_each = local.environments
  name     = "acalpere-deploy"
  role     = aws_iam_role.deploy[each.key].id
  policy   = data.aws_iam_policy_document.deploy[each.key].json
}
