import Script from "next/script"

// Bandeau de consentement cookies (Axeptio). Le clientId identifie la
// configuration Ranti côté Axeptio ; surchargeable par env pour un autre
// projet/environnement, sinon on retombe sur l'ID de production.
const AXEPTIO_CLIENT_ID =
  process.env.NEXT_PUBLIC_AXEPTIO_CLIENT_ID ?? "6a5a4ef8099f6cf5b2bb6406"

// Snippet officiel Axeptio : on pose `axeptioSettings` PUIS on injecte le SDK
// dans un seul script inline pour garantir l'ordre (le SDK lit les réglages au
// chargement). `afterInteractive` : chargé tôt, sans bloquer l'hydratation.
export function AxeptioConsent() {
  return (
    <Script
      id="axeptio"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `window.axeptioSettings = { clientId: ${JSON.stringify(
          AXEPTIO_CLIENT_ID,
        )} };
(function (d, s) {
  var t = d.getElementsByTagName(s)[0], e = d.createElement(s);
  e.async = true; e.src = "https://static.axept.io/sdk.js";
  t.parentNode.insertBefore(e, t);
})(document, "script");`,
      }}
    />
  )
}
