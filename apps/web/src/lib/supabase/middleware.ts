import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // Patron canonique @supabase/ssr : écrire d'abord les cookies
        // rafraîchis sur la REQUÊTE (les Server Components du même passage
        // lisent alors le jeton frais, pas l'expiré), reconstruire la réponse
        // depuis la requête mutée, puis refléter les cookies sur la réponse.
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Ne pas supprimer : permet à Supabase de rafraîchir la session (getSession
  // interne, écrit les cookies via setAll). Contrairement à getUser(), la
  // validation du JWT est LOCALE (ES256, JWKS en cache global 10 min côté
  // auth-js) : zéro aller-retour réseau Auth par navigation. Un jeton legacy
  // HS256 retombe silencieusement sur getUser(), comportement d'avant.
  // Limite assumée (patron recommandé par Supabase) : une session révoquée à
  // distance (« se déconnecter partout », reset mot de passe) reste valable
  // jusqu'à l'expiration du jeton d'accès (TTL projet, 1 h par défaut), là où
  // getUser() la coupait à la navigation suivante.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
