// Pont entre les apps antigues i la plataforma acalpere:
//  - afegeix la capçalera anti-CSRF a totes les peticions al mateix origen
//  - si la sessió ha caducat (401), torna a la pantalla d'accés
//  - si cal una verificació addicional (403 "reverify"), va a /verificar
//  - mostra un enllaç discret per tornar al menú
(function () {
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
        location.href = "/login?next=" + encodeURIComponent(location.pathname);
      }
      // Contingut delicat: el servidor demana confirmar amb la petjada o el codi.
      if (response.status === 403) {
        response.clone().json().then(function (data) {
          if (data && data.detail === "reverify") {
            location.href = "/verificar?next=" + encodeURIComponent(location.pathname);
          }
        }).catch(function () {});
      }
      return response;
    });
  };
  document.addEventListener("DOMContentLoaded", function () {
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
