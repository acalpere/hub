# PAC2 a acalpere.cat

La pàgina pública viu a `frontend/public/apps/pac2/`. No requereix sessió ni fa crides a l'API privada. No modifica l'autenticació de les altres aplicacions.

## Previsualització

Inicia el frontend amb el procediment habitual del repositori i obre `/apps/pac2/`. També pots servir aquesta carpeta amb un servidor estàtic.

## Publicació

La compilació de Vite copia aquesta carpeta a `frontend/dist/apps/pac2/`. El desplegament habitual de producció, documentat al repositori, publica el resultat a S3 i CloudFront. La reescriptura existent de `/apps/x/` resol la portada `index.html`.

Adreça prevista després del desplegament: `https://acalpere.cat/apps/pac2/`. No s'ha de donar per publicada fins a verificar la versió de producció. Comprova l'enllaç en una finestra privada, sense sessió, i prova la navegació del gràfic.

## Completar les dues visualitzacions pendents

A `index.html`, busca els comentaris «Substitueix aquest bloc». Canvia cada `div.pending` pel seu embed definitiu i actualitza l'estat «En preparació», el títol, l'explicació i les fonts. El primer gràfic ja està integrat.

## Fonts

- Primer gràfic: https://public.flourish.studio/visualisation/30738625/
- Identitat UOC: https://www.uoc.edu/content/dam/uoc-common/footer-v2/literal_UOC.svg
- CSV: agrupació del pressupost de despeses de Barcelona 2024 utilitzat en aquesta conversa; 66 grups, total 3.646.517.086,40 €.

El gràfic requereix internet i que el projecte de Flourish continuï publicat. Hi ha un enllaç directe alternatiu si la incrustació no es carrega. La pàgina és un treball acadèmic de l'estudiant, no una pàgina institucional de la UOC. Abans de lliurar, completa les dues visualitzacions pendents i la declaració d'ús d'IA requerida per l'enunciat.
