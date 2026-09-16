import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Refreshes the Supabase session on every request to a guarded page and turns
 * signed-out visitors away from the portal and admin console.
 *
 * This is a gate, not the security boundary - RLS is. A signed-in customer who
 * reached /admin would still see nothing, because the database would return
 * nothing.
 */
const GUARDED = ['/portal', '/admin'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Always call getUser(): it is what revalidates the token and writes refreshed
  // cookies onto `response`.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && GUARDED.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ['/portal/:path*', '/admin/:path*', '/auth/:path*'],
};
