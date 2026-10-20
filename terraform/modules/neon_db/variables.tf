variable "env" { type = string }

variable "neon_project_id" {
  description = "Projecte de Neon (consola: acalpere)"
  type        = string
}

variable "create_branch" {
  description = "true: crea una branca pròpia per a l'entorn (dev). false: fa servir la branca per defecte (prod)."
  type        = bool
  default     = false
}
