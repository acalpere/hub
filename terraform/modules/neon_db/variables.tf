variable "env" { type = string }

variable "neon_region" {
  description = "Regió de Neon propera a la Lambda (eu-west-1): Londres és la més pròxima"
  type        = string
  default     = "aws-eu-west-2"
}
