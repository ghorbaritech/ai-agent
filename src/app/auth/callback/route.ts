import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vggiikngauwyrgogycgn.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_mQY_2j27YJ0ewUZQUk0LNQ_K2PD3_hr',
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing user sessions.
            }
          },
        },
      }
    );
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    
    // Save provider_token for Gmail/Calendar tools if it exists
    if (data.session?.provider_token) {
      cookieStore.set('provider_token', data.session.provider_token, {
        path: '/',
        httpOnly: false, // Allow client to read it for API calls
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600, // 1 hour
      });
    }
  }
  const next = requestUrl.searchParams.get('next') || '/dashboard';
  // URL to redirect to after sign in process completes
  return NextResponse.redirect(requestUrl.origin + next);
}
