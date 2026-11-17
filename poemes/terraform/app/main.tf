provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Application = var.app_name
      ManagedBy   = "Terraform"
    }
  }
}

resource "aws_ecr_repository" "app" {
  name                 = var.app_name
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Conserva les 20 imatges més recents"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.app_name}/database-url"
  description             = "URL agrupada de Neon per a l'aplicació"
  recovery_window_in_days = 7
}

resource "aws_iam_role" "ecr_access" {
  name = "${var.app_name}-apprunner-ecr"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "build.apprunner.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecr_access" {
  role       = aws_iam_role.ecr_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

resource "aws_iam_role" "instance" {
  name = "${var.app_name}-apprunner-instance"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "tasks.apprunner.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "secret_access" {
  name = "read-database-url"
  role = aws_iam_role.instance.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.database_url.arn
    }]
  })
}

resource "aws_iam_role_policy" "bedrock_access" {
  name = "invoke-poemes-embedding-model"
  role = aws_iam_role.instance.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["bedrock:InvokeModel"]
      Resource = "arn:aws:bedrock:${var.aws_region}::foundation-model/${var.bedrock_model_id}"
    }]
  })
}

resource "aws_apprunner_auto_scaling_configuration_version" "app" {
  auto_scaling_configuration_name = var.app_name
  min_size                        = 1
  max_size                        = 5
  max_concurrency                 = 80
}

resource "aws_apprunner_service" "app" {
  service_name = var.app_name

  source_configuration {
    auto_deployments_enabled = false
    authentication_configuration {
      access_role_arn = aws_iam_role.ecr_access.arn
    }
    image_repository {
      image_identifier      = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
      image_repository_type = "ECR"
      image_configuration {
        port = "8080"
        runtime_environment_variables = {
          ENVIRONMENT              = "production"
          LOG_LEVEL                = "INFO"
          SEMANTIC_ENABLED         = "true"
          SEMANTIC_PROVIDER        = "bedrock"
          BEDROCK_MODEL_ID         = var.bedrock_model_id
          BEDROCK_REGION           = var.aws_region
          SEMANTIC_THRESHOLD       = "0.38"
          SEMANTIC_RELATIVE_MARGIN = "0.022"
          SEMANTIC_CANDIDATE_LIMIT = "1200"
        }
        runtime_environment_secrets = {
          DATABASE_URL = aws_secretsmanager_secret.database_url.arn
        }
      }
    }
  }

  instance_configuration {
    cpu               = "1 vCPU"
    memory            = "2 GB"
    instance_role_arn = aws_iam_role.instance.arn
  }

  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.app.arn

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  network_configuration {
    egress_configuration { egress_type = "DEFAULT" }
  }

  depends_on = [
    aws_iam_role_policy_attachment.ecr_access,
    aws_iam_role_policy.secret_access,
    aws_iam_role_policy.bedrock_access,
  ]
}

data "aws_route53_zone" "public" {
  name         = var.route53_zone_name
  private_zone = false
}

resource "aws_apprunner_custom_domain_association" "app" {
  domain_name          = var.custom_domain
  enable_www_subdomain = false
  service_arn          = aws_apprunner_service.app.arn
}

locals {
  certificate_validation_records = tolist(
    aws_apprunner_custom_domain_association.app.certificate_validation_records
  )
}

# App Runner retorna dos CNAME de validació quan no s'activa el subdomini www.
resource "aws_route53_record" "certificate_validation" {
  count = 2

  zone_id         = data.aws_route53_zone.public.zone_id
  name            = local.certificate_validation_records[count.index].name
  type            = "CNAME"
  ttl             = 300
  records         = [local.certificate_validation_records[count.index].value]
  allow_overwrite = true
}

resource "aws_route53_record" "app" {
  zone_id         = data.aws_route53_zone.public.zone_id
  name            = var.custom_domain
  type            = "CNAME"
  ttl             = 300
  records         = [aws_apprunner_custom_domain_association.app.dns_target]
  allow_overwrite = true
}
