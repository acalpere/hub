variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "zone_name" {
  type    = string
  default = "acalpere.cat"
}

variable "serve_web_from_aws" {
  description = "false: apex i www apunten a DreamHost. true: els gestiona envs/prod (CloudFront)."
  type        = bool
  default     = false
}
