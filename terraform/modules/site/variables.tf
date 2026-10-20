variable "env" { type = string }

variable "api_domain" {
  description = "Domini de l'API Gateway (sense https://)"
  type        = string
}

variable "domain_names" {
  description = "Noms de domini de la web (el primer és el principal). Buit = només el domini de CloudFront."
  type        = list(string)
  default     = []
}

variable "zone_name" {
  description = "Zona hostejada de Route 53 (gestionada a terraform/dns)"
  type        = string
  default     = "acalpere.cat"
}
