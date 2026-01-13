import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { FiBriefcase, FiUsers } from 'react-icons/fi';
import { StatCard } from '@/components/ui';
import Link from 'next/link';

async function getAdminStats() {
  const [
    totalCompanies,
    totalUsers,
    recentCompanies,
  ] = await Promise.all([
    prisma.company.count({ where: { is_active: true } }),
    prisma.user.count({ where: { is_active: true } }),
    prisma.company.findMany({
      take: 5,
      orderBy: { date_creation: 'desc' },
      include: {
        _count: { select: { invoices: true, users: true } },
      },
    }),
  ]);

  // Sérialiser les données pour éviter les erreurs de sérialisation Date
  const serializedRecentCompanies = recentCompanies.map(company => ({
    ...company,
    date_creation: company.date_creation.toISOString(),
  }));

  return { 
    totalCompanies, 
    totalUsers, 
    recentCompanies: serializedRecentCompanies 
  };
}

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  const stats = await getAdminStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Bonjour, {user?.nom} 👋</h1>
        <p className="text-dark-400">Voici un aperçu de votre plateforme CloudFNE</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard title="Entreprises" value={stats.totalCompanies} icon={<FiBriefcase className="w-6 h-6 text-white" />} color="primary" />
        <StatCard title="Utilisateurs" value={stats.totalUsers} icon={<FiUsers className="w-6 h-6 text-white" />} color="accent" />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Dernières entreprises</h2>
          <Link href="/admin/companies" className="text-sm text-primary-400 hover:text-primary-300">Voir tout →</Link>
        </div>
        <div className="space-y-4">
          {stats.recentCompanies.map((company) => (
            <div key={company.id} className="flex items-center gap-4 p-4 rounded-xl bg-dark-800/50 hover:bg-dark-800 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-accent-500/20 flex items-center justify-center">
                <FiBriefcase className="w-5 h-5 text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{company.nom}</p>
                <p className="text-xs text-dark-400">{company._count.invoices} factures • {company._count.users} utilisateurs</p>
              </div>
            </div>
          ))}
          {stats.recentCompanies.length === 0 && (
            <p className="text-center text-dark-400 py-8">Aucune entreprise</p>
          )}
        </div>
      </div>
    </div>
  );
}
