variable "aws_region" {
  description = "Regió AWS per a l'estat i el desplegament."
  type        = string
  default     = "eu-west-1"
}

variable "github_repository" {
  description = "Repositori autoritzat a desplegar amb OIDC."
  type        = string
  default     = "acalpere/poemes"
}
