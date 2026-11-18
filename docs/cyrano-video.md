# Vídeo de Cyrano

L'enregistrament de l'obra es reprodueix dins de la pàgina de Cyrano (botó «Vídeo»). Les marques de
temps de la transcripció (`▶ 00:03:01`) fan saltar el vídeo, i mentre es reprodueix es ressalta la
rèplica que toca. El fitxer es diu **`cyrano.mp4`** i no va mai al repositori.

## 1. Preparar el fitxer

H.264 + AAC, amb l'índex al principi (`faststart`) perquè els salts funcionin sense baixar-lo sencer:

```
ffmpeg -i original.mkv -c:v libx264 -crf 23 -preset slow -vf scale=-2:720 \
  -c:a aac -b:a 128k -movflags +faststart cyrano.mp4
```

## 2. Local

Posa'l a `data/media/cyrano.mp4` (carpeta fora de git; es pot canviar amb `ACALPERE_MEDIA_DIR`).
L'API el serveix amb suport de salts (`Range`) només a qui té accés a Cyrano.

## 3. AWS (dev i prod)

1. `terraform apply` a `terraform/envs/dev` (i `prod`): crea el bucket privat
   `acalpere-<env>-media-<compte>`, dona a l'API permís de lectura (`s3:GetObject`) i li passa
   `ACALPERE_MEDIA_BUCKET`. El bucket té `prevent_destroy`.
2. Puja el fitxer (el nom del bucket surt de l'sortida `media_bucket`):

   ```
   aws s3 cp cyrano.mp4 s3://<bucket>/cyrano.mp4 --content-type video/mp4
   ```

3. Desplega el codi. Mentre el fitxer no hi sigui, el botó «Vídeo» no apareix.

## Com funciona

- `GET /api/v1/cyrano/video` comprova l'autorització (app Cyrano) i respon `{available, url}`.
  A AWS, `url` és un enllaç signat d'S3 que dura 4 hores; si caduca durant la reproducció, la pàgina
  en demana un de nou i continua pel mateix punt.
- El bucket no és públic i no hi ha CloudFront pel mig: l'enllaç signat és l'únic accés.
- Pesa gigabytes: no el posis a git ni l'envïis per Lambda (límit de 6 MB per petició).
- Per canviar-lo, torna a pujar `cyrano.mp4` (mateixa ruta).

## Afegir o canviar marques de temps

A Cyrano, en mode **Edició**: obre el vídeo (botó «Vídeo»), para'l on comença la rèplica, clica
«Edita» a aquesta línia i prem **«Agafa l'hora del vídeo»**. Desa. També es pot escriure a mà
(`hh:mm:ss`) o deixar-ho buit per treure la marca. Les marques queden a l'historial de la línia i
surten a l'exportació (`export-cyrano`).
