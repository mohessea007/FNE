import { redirect } from 'next/navigation';
import { getCurrentUser, isAdminLevel } from '@/lib/auth';
import DashboardLayout, { adminNavItems } from '@/components/ui/DashboardLayout';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (!isAdminLevel(user.type_user)) {
    if (user.type_user === 'owner') {
      redirect('/company');
    } else {
      redirect('/login');
    }
  }

  return (
    <DashboardLayout
      user={{
        nom: user.nom,
        username: user.username,
        type_user: user.type_user,
        company: user.company,
      }}
      navItems={adminNavItems}
    >
      {children}
    </DashboardLayout>
  );
}
