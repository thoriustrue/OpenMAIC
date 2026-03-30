/**
 * OpenMAIC Microservice Middleware
 * 
 * Blocks access to the original OpenMAIC UI.
 * Only allows:
 * - /api/atlas/* (Atlas LMS integration)
 * - /api/health (health checks)
 * - Static assets
 * 
 * All other routes redirect to Atlas LMS or return 404.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that are allowed without auth (Atlas integration endpoints)
const PUBLIC_API_ROUTES = [
  '/api/health',
  '/api/atlas/session',
  '/api/atlas/chat',
  '/api/atlas/generate',
];

// Check if route matches allowed patterns
function isAllowedRoute(pathname: string): boolean {
  // Allow all /api/atlas/* routes (they have their own auth)
  if (pathname.startsWith('/api/atlas/')) return true;
  
  // Allow health check
  if (pathname === '/api/health') return true;
  
  // Allow static assets
  if (pathname.startsWith('/_next/')) return true;
  if (pathname.startsWith('/static/')) return true;
  if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) return true;
  
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow public API routes
  if (isAllowedRoute(pathname)) {
    return NextResponse.next();
  }
  
  // Block everything else - return 404 or redirect to Atlas LMS
  const atlasLmsUrl = process.env.ATLAS_LMS_BASE_URL || 'https://atlaslms--atlaslms-f7cdc.us-east4.hosted.app';
  
  // For API requests, return JSON error
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { 
        error: 'This OpenMAIC instance is restricted to Atlas LMS integration only',
        code: 'ACCESS_DENIED',
        documentation: `${atlasLmsUrl}/settings/ai-classroom`
      },
      { status: 403 }
    );
  }
  
  // For page requests, redirect to Atlas LMS
  return NextResponse.redirect(new URL('/settings/ai-classroom', atlasLmsUrl));
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
