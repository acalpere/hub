# L'API (FastAPI + Mangum) en una Lambda darrere d'un API Gateway HTTP API. API Gateway aporta
# limitació de peticions (throttling); el registre d'accés d'API Gateway no s'activa perquè exigeix un
# rol de CloudWatch a nivell de compte (els registres de la Lambda ja ho cobreixen); CloudFront (mòdul site) hi arriba per
# /api/*, de manera que el navegador veu un sol origen i les galetes de sessió funcionen.

terraform {
  required_providers {
    aws    = { source = "hashicorp/aws" }
    random = { source = "hashicorp/random" }
  }
}

data "aws_region" "current" {}

resource "random_password" "secret_key" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "secret_key" {
  name  = "/acalpere/${var.env}/secret_key"
  type  = "SecureString"
  value = random_password.secret_key.result
}

resource "aws_iam_role" "lambda" {
  name = "acalpere-${var.env}-api"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "app" {
  name = "acalpere-app"
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameter"]
      Resource = [var.database_url_ssm_arn, aws_ssm_parameter.secret_key.arn]
    }]
  })
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/acalpere-${var.env}-api"
  retention_in_days = 14
}

resource "aws_lambda_function" "api" {
  function_name    = "acalpere-${var.env}-api"
  role             = aws_iam_role.lambda.arn
  runtime          = "python3.12"
  handler          = "acalpere.lambda_handler.handler"
  filename         = var.package_path
  source_code_hash = filebase64sha256(var.package_path)
  memory_size      = 512
  timeout          = 30
  architectures    = ["x86_64"]

  environment {
    variables = {
      ACALPERE_ENV                    = var.env
      ACALPERE_AWS_REGION             = data.aws_region.current.region
      ACALPERE_DATABASE_URL_SSM_PARAM = var.database_url_ssm_param
      ACALPERE_SECRET_KEY_SSM_PARAM   = aws_ssm_parameter.secret_key.name
      ACALPERE_RP_ID                  = var.rp_id
      # Les migracions les aplica el desplegament (abans de canviar el codi), no cada arrencada.
      ACALPERE_AUTO_MIGRATE = "false"
    }
  }

  depends_on = [aws_cloudwatch_log_group.lambda]
}

resource "aws_apigatewayv2_api" "api" {
  name          = "acalpere-${var.env}"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  # Limita les peticions: protegeix el login de la força bruta i el compte de factures sorpresa.
  default_route_settings {
    throttling_burst_limit = 40
    throttling_rate_limit  = 20
  }

}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
