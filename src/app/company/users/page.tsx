'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FiUsers, FiUserCheck, FiUserX } from 'react-icons/fi';
import { DataTable, Badge, EmptyState, LoadingSpinner } from '@/components/ui';

interface User {
  id: number;
  username: string;
  nom: string;
  email: string | null;
  type_user: string;
  role: string;
  is_active: boolean;
  date_creation: string;
}

export default function CompanyUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/company/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const columns = [
    { key: 'username', label: 'Nom d\'utilisateur' },
    { key: 'nom', label: 'Nom complet' },
    { key: 'email', label: 'Email', render: (v: string | null) => v || '-' },
    { key: 'type_user', label: 'Type', render: (v: string) => (
      <Badge variant={v === 'owner' ? 'primary' : 'info'}>{v}</Badge>
    )},
    { key: 'role', label: 'Rôle', render: (v: string) => (
      <Badge variant={v === 'admin' ? 'warning' : 'info'}>{v}</Badge>
    )},
    { key: 'is_active', label: 'Statut', render: (v: boolean) => (
      <Badge variant={v ? 'success' : 'danger'}>{v ? 'Actif' : 'Inactif'}</Badge>
    )},
    { key: 'date_creation', label: 'Créé le', render: (v: string) => new Date(v).toLocaleDateString('fr-FR') },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Utilisateurs</h1>
          <p className="text-dark-400">Gérez les utilisateurs de votre entreprise</p>
        </div>
      </div>

      {users.length === 0 ? (
        <EmptyState icon={<FiUsers className="w-8 h-8" />} title="Aucun utilisateur" description="Aucun utilisateur trouvé pour le moment." />
      ) : (
        <DataTable columns={columns} data={users} />
      )}
    </div>
  );
}

