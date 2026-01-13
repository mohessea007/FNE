'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { 
  FiMenu, FiLogOut, FiUser, 
  FiHome, FiUsers, FiFileText,
  FiMapPin, FiChevronDown, FiBriefcase
} from 'react-icons/fi';
import { StopImpersonationButton } from '@/components/StopImpersonationButton';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  children?: { label: string; href: string }[];
}

interface DashboardLayoutProps {
  children: ReactNode;
  user: {
    nom: string;
    username: string;
    type_user: string;
    company?: { nom: string } | null;
  };
  navItems: NavItem[];
  title?: string;
  isImpersonating?: boolean;
}

export default function DashboardLayout({ children, user, navItems, title, isImpersonating }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Déconnexion réussie');
      router.push('/login');
    } catch {
      toast.error('Erreur lors de la déconnexion');
    }
  };

  const toggleExpanded = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) 
        ? prev.filter(item => item !== label)
        : [...prev, label]
    );
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const getUserTypeLabel = () => {
    const types: Record<string, string> = {
      developer: 'Développeur',
      superadmin: 'Super Admin',
      admin: 'Admin',
      owner: 'Propriétaire',
      client: 'Client',
    };
    return types[user.type_user] || user.type_user;
  };

  return (
    <div className="min-h-screen bg-dark-950 mesh-bg">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-72 bg-dark-900/95 backdrop-blur-xl border-r border-dark-700/50
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-dark-700/50">
            <Link href="/" className="flex items-center gap-3">
              <img 
                src="/logo-icon.svg" 
                alt="CloudFNE Pro" 
                className="w-10 h-10"
              />
              <span className="text-xl font-bold gradient-text">CloudFNE Pro</span>
            </Link>
          </div>

          {/* User info */}
          <div className="p-4 border-b border-dark-700/50">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-dark-800/50">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <FiUser className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{user.nom}</p>
                <p className="text-xs text-dark-400">{getUserTypeLabel()}</p>
              </div>
            </div>
            {user.company && (
              <div className="mt-2 px-3 py-2 rounded-lg bg-primary-500/10 border border-primary-500/20">
                <p className="text-xs text-primary-400 flex items-center gap-2">
                  <FiBriefcase className="w-3 h-3" />
                  {user.company.nom}
                </p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => (
              <div key={item.label}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleExpanded(item.label)}
                      className={`sidebar-link w-full justify-between ${
                        isActive(item.href) ? 'active' : ''
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        {item.icon}
                        {item.label}
                      </span>
                      <FiChevronDown className={`w-4 h-4 transition-transform ${
                        expandedItems.includes(item.label) ? 'rotate-180' : ''
                      }`} />
                    </button>
                    {expandedItems.includes(item.label) && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`sidebar-link text-sm ${
                              pathname === child.href ? 'active' : ''
                            }`}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link href={item.href} className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}>
                    {item.icon}
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* Actions */}
          <div className="p-4 border-t border-dark-700/50 space-y-2">
            {isImpersonating && <StopImpersonationButton />}
            <button onClick={handleLogout} className="sidebar-link w-full text-danger-400 hover:text-danger-300 hover:bg-danger-500/10">
              <FiLogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-72">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-dark-900/80 backdrop-blur-xl border-b border-dark-700/50">
          <div className="flex items-center px-6 py-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-dark-800 transition-colors mr-4"
            >
              <FiMenu className="w-6 h-6 text-dark-300" />
            </button>
            {title && <h1 className="text-xl font-semibold text-white">{title}</h1>}
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// Navigation configurations
export const adminNavItems: NavItem[] = [
  { label: 'Tableau de bord', href: '/admin', icon: <FiHome className="w-5 h-5" /> },
  { label: 'Entreprises', href: '/admin/companies', icon: <FiBriefcase className="w-5 h-5" /> },
  { label: 'Utilisateurs', href: '/admin/users', icon: <FiUsers className="w-5 h-5" /> },
];

export const companyNavItems: NavItem[] = [
  { label: 'Tableau de bord', href: '/company', icon: <FiHome className="w-5 h-5" /> },
  { label: 'Points de vente', href: '/company/pointdeventes', icon: <FiMapPin className="w-5 h-5" /> },
  { label: 'Clients', href: '/company/clients', icon: <FiUsers className="w-5 h-5" /> },
  { label: 'Factures', href: '/company/invoices', icon: <FiFileText className="w-5 h-5" /> },
  { label: 'Utilisateurs', href: '/company/users', icon: <FiUser className="w-5 h-5" /> },
];

// Navigation limitée pour le mode impersonation (admin se connectant en tant qu'entreprise)
export const companyImpersonationNavItems: NavItem[] = [
  { label: 'Tableau de bord', href: '/company', icon: <FiHome className="w-5 h-5" /> },
  { label: 'Points de vente', href: '/company/pointdeventes', icon: <FiMapPin className="w-5 h-5" /> },
  { label: 'Clients', href: '/company/clients', icon: <FiUsers className="w-5 h-5" /> },
  { label: 'Factures', href: '/company/invoices', icon: <FiFileText className="w-5 h-5" /> },
];
