// Pont entre les apps antigues i la plataforma acalpere:
//  - afegeix la capçalera anti-CSRF a totes les peticions al mateix origen
//  - si la sessió ha caducat (401), torna a la pantalla d'accés
//  - si cal una verificació addicional (403 "reverify"), va a /verificar
//  - mostra un enllaç discret per tornar al menú
(function () {
  // Dins del hub, l'app s'obre en un marc sota el menú principal: les redireccions i el retorn
  // han d'anar a la finestra superior, i el camí de tornada és el de l'SPA (/app/x), no el de l'app.
  var framed = window.self !== window.top;
  var topWin = framed ? window.top : window;
  var shell = /^\/apps\/([^/]+)/.exec(location.pathname);
  var returnPath = framed && shell ? "/app/" + shell[1] : location.pathname;
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    init = init || {};
    var url = typeof input === "string" ? input : input.url;
    if (url.startsWith("/") || url.startsWith(location.origin)) {
      var headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined));
      headers.set("X-Requested-With", "acalpere");
      init.headers = headers;
      init.credentials = "same-origin";
    }
    return nativeFetch(input, init).then(function (response) {
      if (response.status === 401) {
        topWin.location.href = "/login?next=" + encodeURIComponent(returnPath);
      }
      // Contingut delicat: el servidor demana confirmar amb la petjada o el codi.
      if (response.status === 403) {
        response.clone().json().then(function (data) {
          if (data && data.detail === "reverify") {
            topWin.location.href = "/verificar?next=" + encodeURIComponent(returnPath);
          }
        }).catch(function () {});
      }
      return response;
    });
  };
  // Herència: en sortir de la pàgina (tancar, recarregar, canviar d'adreça) la verificació caduca.
  if (location.pathname.indexOf("/apps/herencia") === 0) {
    window.addEventListener("pagehide", function () {
      window.fetch("/api/v1/auth/reverify/end", { method: "POST", keepalive: true });
    });
  }
  document.addEventListener("DOMContentLoaded", function () {
    if (framed) return; // el menú principal ja és a sobre
    var back = document.createElement("a");
    back.href = "/";
    back.textContent = "← acalpere";
    back.style.cssText =
      "position:fixed;left:10px;bottom:10px;z-index:20000;font:600 13px system-ui,sans-serif;" +
      "color:#7a2e2e;background:#fffc;padding:4px 10px;border-radius:14px;text-decoration:none;" +
      "box-shadow:0 1px 4px #0003";
    document.body.appendChild(back);
  });
})();
