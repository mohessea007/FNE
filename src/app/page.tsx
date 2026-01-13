import { redirect } from 'next/navigation';
import { getCurrentUser, isAdminLevel, isCompanyLevel } from '@/lib/auth';

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Rediriger vers le tableau de bord approprié selon le type d'utilisateur
  if (isAdminLevel(user.type_user)) {
    redirect('/admin');
  } else if (isCompanyLevel(user.type_user)) {
    redirect('/company');
  } else {
    // Pour les autres types d'utilisateurs (comme client qui n'existe plus), rediriger vers login
    redirect('/login');
  }
}
