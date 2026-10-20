variable "env" { type = string }
variable "alert_email" { type = string }

variable "limit_usd" {
  type    = number
  default = 10
}
