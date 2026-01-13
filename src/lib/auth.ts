import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import prisma from './prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'cloudfne_super_secret_jwt_key_2025_change_in_production'
);

export interface JWTPayload {
  userId: number;
  username: string;
  type_user: string;
  role: string;
  companieid?: number | null;
  clientid?: number | null;
  exp?: number;
}

// Generate JWT Token
export async function generateToken(payload: Omit<JWTPayload, 'exp'>): Promise<string> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
  
  return token;
}

// Verify JWT Token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    // Extraire les propriétés du payload et les mapper vers notre interface
    return {
      userId: payload.userId as number,
      username: payload.username as string,
      type_user: payload.type_user as string,
      role: payload.role as string,
      companieid: payload.companieid as number | null | undefined,
      clientid: payload.clientid as number | null | undefined,
      exp: payload.exp as number | undefined,
    };
  } catch {
    return null;
  }
}

// Hash Password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify Password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Get current user from cookies
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      company: true,
      client: true,
    },
  });

  if (!user || !user.is_active) {
    return null;
  }

  // Vérifier si on est en mode impersonation
  const impersonateCompanyId = cookieStore.get('impersonate_company_id')?.value;
  if (impersonateCompanyId && isAdminLevel(user.type_user)) {
    const impersonatedCompany = await prisma.company.findUnique({
      where: { id: parseInt(impersonateCompanyId) },
    });

    if (impersonatedCompany && impersonatedCompany.is_active) {
      // Retourner l'utilisateur avec l'entreprise impersonnée
      return {
        ...user,
        companieid: parseInt(impersonateCompanyId),
        company: impersonatedCompany,
        isImpersonating: true,
      };
    }
  }

  return user;
}

// Generate API Key
export function generateApiKey(): string {
  const crypto = require('crypto');
  return 'sk_' + crypto.randomBytes(16).toString('hex');
}

// Generate UID
export function generateUID(): string {
  const { v4: uuidv4 } = require('uuid');
  return uuidv4();
}

// Validate API Key and get company
export async function validateApiKey(apiKey: string) {
  if (!apiKey) return null;

  const company = await prisma.company.findFirst({
    where: {
      OR: [
        { api_key: apiKey },
        { token_fne: apiKey },
      ],
      is_active: true,
    },
    include: {
      pointdeventes: true,
    },
  });

  return company;
}

// Check user permissions
export function canManageUsers(userType: string, targetType: string): boolean {
  const hierarchy = ['developer', 'superadmin', 'admin', 'owner'];
  const userLevel = hierarchy.indexOf(userType);
  const targetLevel = hierarchy.indexOf(targetType);
  
  // User can only manage users at a lower level
  return userLevel < targetLevel && userLevel !== -1;
}

// Check if user is admin level
export function isAdminLevel(userType: string): boolean {
  return ['developer', 'superadmin', 'admin'].includes(userType);
}

// Check if user is company level (owner)
export function isCompanyLevel(userType: string): boolean {
  return userType === 'owner';
}

// Check if user is developer level
export function isDeveloperLevel(userType: string): boolean {
  return userType === 'developer';
}
