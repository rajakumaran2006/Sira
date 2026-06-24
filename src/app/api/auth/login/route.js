import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { connectDB } from '@/server/db.js';
import User from '@/server/models/User.js';
import { signToken } from '@/server/authHelper.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    await connectDB();
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const user = await User.findOne({ username });
    
    // Direct comparison as requested (do not encode)
    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const token = signToken({ userId: user._id, username: user.username });
    
    // Set session cookie
    const cookieStore = cookies();
    cookieStore.set('sira_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60, // 1 day
    });

    return NextResponse.json({ success: true, user: { username: user.username } });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
