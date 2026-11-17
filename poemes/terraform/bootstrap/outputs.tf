output "github_actions_role_arn" {
  value       = aws_iam_role.github_actions.arn
  description = "Valor de la variable GitHub AWS_ROLE_ARN."
}

output "terraform_state_bucket" {
  value       = aws_s3_bucket.terraform_state.id
  description = "Valor de la variable GitHub TF_STATE_BUCKET."
}

output "aws_region" {
  value = var.aws_region
}
