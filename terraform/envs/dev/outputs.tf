output "web_url" { value = module.site.url }
output "web_bucket" { value = module.site.bucket }
output "distribution_id" { value = module.site.distribution_id }
output "database_url_unpooled_ssm_param" { value = module.database.database_url_unpooled_ssm_param }
