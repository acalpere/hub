output "bucket" { value = aws_s3_bucket.web.bucket }
output "distribution_id" { value = aws_cloudfront_distribution.this.id }
output "cloudfront_domain" { value = aws_cloudfront_distribution.this.domain_name }
output "url" {
  value = local.custom_domain ? "https://${var.domain_names[0]}" : "https://${aws_cloudfront_distribution.this.domain_name}"
}
