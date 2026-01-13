'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function HomeNavigation() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dashboardUrl, setDashboardUrl] = useState('/login');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();

        if (data.success && data.data) {
          setIsAuthenticated(true);
          // Déterminer l'URL du tableau de bord selon le type d'utilisateur
          const userType = data.data.type_user;
          if (['developer', 'superadmin', 'admin'].includes(userType)) {
            setDashboardUrl('/admin');
          } else if (userType === 'owner') {
            setDashboardUrl('/company');
          } else {
            setDashboardUrl('/');
          }
        } else {
          setIsAuthenticated(false);
          setDashboardUrl('/login');
        }
      } catch (error) {
        setIsAuthenticated(false);
        setDashboardUrl('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img 
              src="/logo-icon.svg" 
              alt="CloudFNE Pro" 
              className="w-10 h-10"
            />
            <span className="text-xl font-bold gradient-text">CloudFNE Pro</span>
          </Link>

          <div className="flex items-center gap-4">
            {!loading && (
              <Link href={dashboardUrl} className="btn-ghost">
                {isAuthenticated ? 'Tableau de bord' : 'Connexion'}
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

