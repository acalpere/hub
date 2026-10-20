output "api_domain" {
  value = replace(aws_apigatewayv2_api.api.api_endpoint, "https://", "")
}
output "function_name" { value = aws_lambda_function.api.function_name }
