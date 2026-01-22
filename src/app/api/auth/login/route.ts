import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { generateToken, verifyPassword } from '@/lib/auth';
import { validate, loginSchema } from '@/lib/validations';
import { successResponse, errorResponse, validationErrorResponse, parseJsonBody } from '@/lib/api-utils';

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    
    if (!body) {
      return errorResponse('Corps de requête invalide', 400);
    }

    // Validate input
    const validation = validate(loginSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation.errors);
    }

    const { username, password } = validation.data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        company: true,
        client: true,
      },
    });

    if (!user) {
      return errorResponse('Identifiants invalides', 401);
    }

    if (!user.is_active) {
      return errorResponse('Compte désactivé', 401);
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return errorResponse('Identifiants invalides', 401);
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    // Generate token
    const token = await generateToken({
      userId: user.id,
      username: user.username,
      type_user: user.type_user,
      role: user.role,
      companieid: user.companieid,
      clientid: user.clientid,
    });

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.startsWith('https'),
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  });

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;

    return successResponse({
      token,
      user: userWithoutPassword,
    }, 'Connexion réussie');
  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('Erreur serveur', 500);
  }
}
