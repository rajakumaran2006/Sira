import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/server/authHelper.js';
import { connectDB } from '@/server/db.js';
import User from '@/server/models/User.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('sira_session');

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: 'Unauthorized: No active session' }, { status: 401 });
    }

    const payload = verifyToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized: Session invalid or expired' }, { status: 401 });
    }

    let avatarUrl = payload.avatarUrl;
    if (!avatarUrl) {
      try {
        await connectDB();
        const user = await User.findOne({ username: payload.username });
        if (user) {
          avatarUrl = user.avatarUrl;
        }
      } catch (dbErr) {
        console.error('Error fetching user for avatar fallback:', dbErr);
      }
    }

    return NextResponse.json({ success: true, user: { username: payload.username, avatarUrl } });
  } catch (error) {
    console.error('Session verification error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
