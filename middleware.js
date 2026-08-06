export const config = {
  matcher: "/((?!_vercel).*)",
};

function unauthorized() {
  return new Response("Authentification requise.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="CRM 100% Immo"' },
  });
}

// Protège tout le site (page + API) par Basic Auth. Volontairement "fail closed" :
// si DASHBOARD_PASSWORD n'est pas configuré, l'accès est bloqué plutôt que laissé ouvert,
// car ce dashboard affiche des coordonnées personnelles de leads.
export default function middleware(request) {
  const expectedUser = process.env.DASHBOARD_USER || "100immo";
  const expectedPass = process.env.DASHBOARD_PASSWORD;

  if (!expectedPass) return unauthorized();

  const auth = request.headers.get("authorization");
  if (!auth) return unauthorized();

  const [scheme, encoded] = auth.split(" ");
  if (scheme !== "Basic" || !encoded) return unauthorized();

  let decoded;
  try {
    decoded = atob(encoded);
  } catch {
    return unauthorized();
  }
  const sep = decoded.indexOf(":");
  const user = sep >= 0 ? decoded.slice(0, sep) : decoded;
  const pass = sep >= 0 ? decoded.slice(sep + 1) : "";

  if (user === expectedUser && pass === expectedPass) return;

  return unauthorized();
}
