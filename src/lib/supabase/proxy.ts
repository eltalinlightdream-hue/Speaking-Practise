import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

// Paths anyone can open without signing in.
const PUBLIC_PATHS = ["/", "/login", "/privacy", "/design", "/manifest.webmanifest"];
const PUBLIC_PREFIXES = ["/auth/"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

// Refreshes the Supabase session cookie on every request and sends signed-out
// visitors of private pages to /login. Role checks happen on the server pages
// themselves and in the database (row level security).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not put code between createServerClient and getClaims().
  // getClaims() checks the login token's signature on this server (the
  // project uses asymmetric signing keys), so most requests no longer wait
  // for a round trip to Supabase Auth. It still refreshes expired tokens.
  let user: { sub: string } | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    user = data?.claims?.sub ? { sub: data.claims.sub } : null;
  } catch {
    user = null;
  }

  const { pathname } = request.nextUrl;
  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
