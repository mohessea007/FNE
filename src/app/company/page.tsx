import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCurrentUser, isAdminLevel } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { FiUsers, FiFileText, FiCheckCircle, FiXCircle, FiMapPin } from 'react-icons/fi';
import { StatCard } from '@/components/ui';
import { CompanyInvoiceTable } from '@/components/company/CompanyInvoiceTable';
import Link from 'next/link';

async function getCompanyStats(companyId: number) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      pointdeventes: { where: { is_active: true } },
      _count: { select: { clients: true, invoices: true, users: true } },
    },
  });

  if (!company) return null;

  const [
    certifiedInvoices,
    rejectedInvoices,
    recentInvoices,
    totalRevenue,
  ] = await Promise.all([
    prisma.invoice.count({ where: { uid_companie: company.uid_companie, status: 'certified' } }),
    prisma.invoice.count({ where: { uid_companie: company.uid_companie, status: 'rejected' } }),
    prisma.invoice.findMany({
      where: { uid_companie: company.uid_companie },
      take: 10,
      orderBy: { date_creation: 'desc' },
      include: {
        client: { select: { clientCompanyName: true } },
        items: true,
      },
    }),
    prisma.itemInvoice.aggregate({
      where: { uid_companie: company.uid_companie },
      _sum: { amount: true },
    }),
  ]);

  // Sérialiser les données pour éviter les erreurs de sérialisation Date
  const serializedRecentInvoices = recentInvoices.map(invoice => ({
    ...invoice,
    date_creation: invoice.date_creation.toISOString(),
  }));

  const serializedCompany = {
    ...company,
    date_creation: company.date_creation.toISOString(),
    date_modification: company.date_modification.toISOString(),
  };

  return {
    company: serializedCompany,
    certifiedInvoices,
    rejectedInvoices,
    recentInvoices: serializedRecentInvoices,
    totalRevenue: totalRevenue._sum.amount || 0,
  };
}

export default async function CompanyDashboard() {
  const user = await getCurrentUser();
  if (!user?.companieid) redirect('/login');

  // Vérifier si on est en mode impersonation
  const cookieStore = await cookies();
  const impersonateCompanyId = cookieStore.get('impersonate_company_id')?.value;
  const isImpersonating = isAdminLevel(user.type_user) && !!impersonateCompanyId;

  const stats = await getCompanyStats(user.companieid);
  if (!stats) redirect('/login');

  const { company, certifiedInvoices, rejectedInvoices, recentInvoices, totalRevenue } = stats;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">{company.nom}</h1>
        <p className="text-dark-400">Tableau de bord de votre entreprise</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard title="Points de vente" value={company.pointdeventes.length} icon={<FiMapPin className="w-6 h-6 text-white" />} color="primary" />
        <StatCard title="Clients" value={company._count.clients} icon={<FiUsers className="w-6 h-6 text-white" />} color="accent" />
        <StatCard title="Total Factures" value={company._count.invoices} icon={<FiFileText className="w-6 h-6 text-white" />} color="warning" />
        <StatCard title="Certifiées" value={certifiedInvoices} icon={<FiCheckCircle className="w-6 h-6 text-white" />} color="success" />
        <StatCard title="Rejetées" value={rejectedInvoices} icon={<FiXCircle className="w-6 h-6 text-white" />} color="danger" />
      </div>

      {/* Recent Invoices */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Dernières factures</h2>
          <Link href="/company/invoices" className="text-sm text-primary-400 hover:text-primary-300">Voir tout →</Link>
        </div>
        <CompanyInvoiceTable invoices={recentInvoices} />
      </div>
    </div>
  );
}
