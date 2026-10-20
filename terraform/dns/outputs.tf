output "name_servers" {
  description = "Servidors de noms que s'han de posar a OVH per delegar el domini a Route 53"
  value       = aws_route53_zone.this.name_servers
}
