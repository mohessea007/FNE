import { cookies } from 'next/headers';
import { getCurrentUser, isAdminLevel } from '@/lib/auth';
import { successResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';

// POST /api/admin/impersonate/stop - Stop impersonation
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  if (!isAdminLevel(user.type_user)) return forbiddenResponse();

  const cookieStore = await cookies();
  cookieStore.delete('impersonate_company_id');

  return successResponse(null, 'Impersonation terminée');
}

