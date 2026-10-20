output "state_bucket" { value = aws_s3_bucket.tfstate.bucket }
output "deploy_role_arns" { value = { for k, r in aws_iam_role.deploy : k => r.arn } }
