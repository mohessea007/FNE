import { cookies } from 'next/headers';
import { successResponse } from '@/lib/api-utils';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  
  return successResponse(null, 'Déconnexion réussie');
}

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  
  return successResponse(null, 'Déconnexion réussie');
}
