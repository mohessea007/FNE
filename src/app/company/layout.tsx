import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCurrentUser, isCompanyLevel, isAdminLevel } from '@/lib/auth';
import DashboardLayout, { companyNavItems, companyImpersonationNavItems } from '@/components/ui/DashboardLayout';

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Allow owners and admins (admins can access as company via impersonation)
  if (!isCompanyLevel(user.type_user) && !isAdminLevel(user.type_user)) {
    redirect('/login');
  }

  // Check if admin is impersonating
  const cookieStore = await cookies();
  const impersonateCompanyId = cookieStore.get('impersonate_company_id')?.value;
  const isImpersonating = isAdminLevel(user.type_user) && !!impersonateCompanyId;

  // For owners, they must have a company
  if (user.type_user === 'owner' && !user.companieid) {
    redirect('/login');
  }

  // For admins impersonating, they must have the company ID from cookie
  if (isImpersonating && !user.companieid) {
    redirect('/admin');
  }

  // Use limited navigation items if impersonating
  const navItems = isImpersonating ? companyImpersonationNavItems : companyNavItems;

  return (
    <DashboardLayout
      user={{
        nom: user.nom,
        username: user.username,
        type_user: user.type_user,
        company: user.company,
      }}
      navItems={navItems}
      isImpersonating={isImpersonating}
    >
      {children}
    </DashboardLayout>
  );
}
