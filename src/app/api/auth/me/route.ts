import { getCurrentUser } from '@/lib/auth';
import { successResponse, unauthorizedResponse } from '@/lib/api-utils';

export async function GET() {
  const user = await getCurrentUser();
  
  if (!user) {
    return unauthorizedResponse('Non authentifié');
  }

  const { password: _, ...userWithoutPassword } = user;
  
  return successResponse(userWithoutPassword);
}
