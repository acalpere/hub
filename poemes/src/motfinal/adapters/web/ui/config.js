// Configuració de la interfície. Qui l'incrusta (p. ex. el hub acalpere) en genera una altra còpia.
window.MOTFINAL = {
  api: "/api/v1",        // prefix de l'API
  csrf: "motfinal",      // valor de la capçalera X-Requested-With
  auth: "password",      // "password": formulari propi · "host": la sessió la gestiona qui incrusta
  loginUrl: null,        // amb auth "host": pàgina d'inici de sessió
  homeUrl: null,         // qui l'incrusta pot mostrar un retorn persistent al seu inici
};
