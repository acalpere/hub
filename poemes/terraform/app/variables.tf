variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "app_name" {
  type    = string
  default = "poemes"
}

variable "bedrock_model_id" {
  description = "Model multilingüe de Bedrock utilitzat per al filtre semàntic."
  type        = string
  default     = "cohere.embed-multilingual-v3"
}

variable "image_tag" {
  description = "Etiqueta immutable de la imatge, normalment el SHA de Git."
  type        = string
}

variable "custom_domain" {
  description = "Subdomini públic de l'aplicació."
  type        = string
  default     = "poemes.acalpere.cat"
}

variable "route53_zone_name" {
  description = "Zona pública de Route 53 on es creen els registres del subdomini."
  type        = string
  default     = "acalpere.cat"
}
