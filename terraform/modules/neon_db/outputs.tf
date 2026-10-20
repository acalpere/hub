output "database_url_ssm_param" { value = aws_ssm_parameter.database_url.name }
output "database_url_ssm_arn" { value = aws_ssm_parameter.database_url.arn }
output "database_url_unpooled_ssm_param" { value = aws_ssm_parameter.database_url_unpooled.name }
