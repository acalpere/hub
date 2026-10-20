variable "env" { type = string }
variable "package_path" { type = string }
variable "database_url_ssm_param" { type = string }
variable "database_url_ssm_arn" { type = string }

variable "rp_id" {
  description = "Domini de les claus d'accés (WebAuthn). Buit: es dedueix de l'origen de la petició."
  type        = string
  default     = ""
}
