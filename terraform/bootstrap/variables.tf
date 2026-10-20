variable "aws_region" {
  type    = string
  default = "eu-west-1"
}

variable "github_repo" {
  description = "Repositori en format propietari/nom"
  type        = string
  default     = "acalpere/hub"
}

variable "github_owner_id" {
  description = "ID numèric del propietari a GitHub (gh api users/<usuari> --jq .id)"
  type        = string
  default     = "85281506"
}

variable "github_repo_id" {
  description = "ID numèric del repositori a GitHub (gh api repos/<propietari>/<repo> --jq .id)"
  type        = string
  default     = "1427122086"
}
