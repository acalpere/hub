# Bucket privat per als fitxers multimèdia grans (el vídeo de Cyrano). Cap accés públic ni CloudFront:
# l'API comprova l'autorització de l'usuari i li dona un enllaç temporal signat. El fitxer es puja a mà
# (aws s3 cp), no des de la web: vegeu docs/cyrano-video.md.

terraform {
  required_providers {
    aws = { source = "hashicorp/aws" }
  }
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "media" {
  bucket = "acalpere-${var.env}-media-${data.aws_caller_identity.current.account_id}"

  # Un vídeo que no es pot tornar a crear amb una ordre: no es destrueix per accident.
  lifecycle { prevent_destroy = true }
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

# Una pujada gran interrompuda deixa parts amagades que es cobren: s'esborren al cap d'una setmana.
resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}
