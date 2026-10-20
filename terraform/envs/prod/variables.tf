variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "package_path" {
  description = "Zip de la Lambda (scripts/build_lambda.sh)"
  type        = string
  default     = "../../../build/lambda.zip"
}

variable "alert_email" { type = string }

variable "use_custom_domain" {
  description = "Activa el domini propi (certificat + alias). Cal que Route 53 ja sigui el DNS de la zona."
  type        = bool
  default     = false
}
