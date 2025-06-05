import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;

  // Check for either Supabase session token or our custom cookie
  const supabaseToken = request.cookies.get('sb-access-token')?.value;
  const isAuthenticated = request.cookies.get('isAuthenticated')?.value;

  // Define public paths that don't require authentication
  const isPublicPath = path === '/login';

  // If neither token exists and trying to access a protected route,
  // redirect them to the login page
  if (!supabaseToken && !isAuthenticated && !isPublicPath) {
    const url = new URL('/login', request.url);
    return NextResponse.redirect(url);
  }

  // If authenticated and trying to access login page,
  // redirect them to the home page
  if ((supabaseToken || isAuthenticated) && isPublicPath) {
    const url = new URL('/', request.url);
    return NextResponse.redirect(url);
  }

  // Continue with the request if none of the above conditions are met
  return NextResponse.next();
}

// Configure which routes should be handled by this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
