# DNS d'acalpere.cat a Route 53. Pila independent dels entorns: la zona perdura encara que
# es destrueixi dev o prod, i s'aplica a mà (no des del CI).
#
# El domini es registra a OVH. Aquesta pila només crea la zona i hi replica els registres
# actuals; fins que a OVH no es canviïn els servidors de noms pels d'aquesta zona (output
# `name_servers`) no té cap efecte sobre la web viva ni sobre el correu.

terraform {
  required_version = ">= 1.10"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
  backend "s3" {
    key          = "dns/terraform.tfstate"
    region       = "eu-west-1"
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region
  default_tags { tags = { Project = "acalpere", ManagedBy = "terraform", Component = "dns" } }
}

resource "aws_route53_zone" "this" {
  name    = var.zone_name
  comment = "acalpere.cat (registrat a OVH; DNS a Route 53)"
}

locals {
  ttl = 300

  # Registres exportats de la zona d'OVH el 2026-11-17. Es mantenen els serveis
  # de DreamHost i MailChannels mentre només migrem la gestió DNS a Route 53.
  records = {
    "autoconfig"  = { type = "CNAME", values = ["autoconfig.dreamhost.com."] }
    "dades"       = { type = "A", values = ["208.97.144.161"] }
    "ftp"         = { type = "CNAME", values = ["acalpere.cat."] }
    "ftp.dades"   = { type = "A", values = ["208.97.144.161"] }
    "ftp.mare"    = { type = "A", values = ["208.97.144.161"] }
    "mail"        = { type = "A", values = ["64.90.62.162"] }
    "mailboxes"   = { type = "A", values = ["69.163.136.97"] }
    "mare"        = { type = "A", values = ["208.97.144.161"] }
    "ssh"         = { type = "A", values = ["208.97.144.161"] }
    "ssh.dades"   = { type = "A", values = ["208.97.144.161"] }
    "ssh.mare"    = { type = "A", values = ["208.97.144.161"] }
    "web"         = { type = "A", values = ["208.97.132.83"] }
    "webmail"     = { type = "A", values = ["69.163.136.138"] }
    "www.webmail" = { type = "A", values = ["69.163.136.138"] }

    # La Lira (altre projecte, ja a AWS)
    "lalira"     = { type = "CNAME", values = ["d2zagp7ix3bb7j.cloudfront.net."] }
    "www.lalira" = { type = "CNAME", values = ["d2zagp7ix3bb7j.cloudfront.net."] }
  }

  # Apex i www: a DreamHost fins al canvi. Quan `serve_web_from_aws` és true, aquests registres
  # desapareixen d'aquí i passen a ser alies de CloudFront (envs/prod amb use_custom_domain).
  legacy_web = var.serve_web_from_aws ? {} : {
    "@"   = { type = "A", values = ["208.97.144.161"] }
    "www" = { type = "A", values = ["208.97.144.161"] }
  }

  all_records = merge(local.records, local.legacy_web)
}

resource "aws_route53_record" "this" {
  for_each = local.all_records
  zone_id  = aws_route53_zone.this.zone_id
  name     = each.key == "@" ? var.zone_name : "${each.key}.${var.zone_name}"
  type     = each.value.type
  ttl      = local.ttl
  records  = each.value.values
}

# Apex: correu (MailChannels/DreamHost) i SPF.
resource "aws_route53_record" "mx" {
  zone_id = aws_route53_zone.this.zone_id
  name    = var.zone_name
  type    = "MX"
  ttl     = local.ttl
  records = ["0 mx1.mailchannels.net.", "0 mx2.mailchannels.net."]
}

resource "aws_route53_record" "spf" {
  zone_id = aws_route53_zone.this.zone_id
  name    = var.zone_name
  type    = "TXT"
  ttl     = local.ttl
  records = ["v=spf1 mx include:netblocks.dreamhost.com include:relay.mailchannels.net -all"]
}

resource "aws_route53_record" "autodiscover" {
  zone_id = aws_route53_zone.this.zone_id
  name    = "_autodiscover._tcp.${var.zone_name}"
  type    = "SRV"
  ttl     = local.ttl
  records = ["5 0 443 autoconfig.dreamhost.com."]
}

resource "aws_route53_record" "dkim" {
  zone_id = aws_route53_zone.this.zone_id
  name    = "dreamhost._domainkey.${var.zone_name}"
  type    = "TXT"
  ttl     = local.ttl
  records = ["v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu9efaKPz/sgSBjPbm6a3V82mxk57nYxEakyKFFsKcDAN9QEB3cDBIVOjNFBFNxvQdHRi+jLSny2DzybqucsYgChVOVskow84xR19wgXxooSF1+6tanGcVKqTsWUFgxxv6+HqhDnb/8yuIOqukh8zLaPO7pTiPA88iT1blSBwxIvbnuZsnZ\" \"UMqXbxnZoqeANmtjvbJXDCK/qC76nDPEjwVF8kVxXpjH1jFwVDwljHobg7Z1gtQX99op8PioyxKZ2xKaWXawyqvfQJotBtOFoyPQQwB6ZJkfEG81QN3AHXxy7yUOfdouhpbk4x/NBXZrlCcuwAjqqCFSNHWOHLxtpq2QIDAQAB; s=email;"]
}

resource "aws_route53_record" "mail_mx" {
  zone_id = aws_route53_zone.this.zone_id
  name    = "mail.${var.zone_name}"
  type    = "MX"
  ttl     = local.ttl
  records = ["0 mx1.mailchannels.net.", "0 mx2.mailchannels.net."]
}
