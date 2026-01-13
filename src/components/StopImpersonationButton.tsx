'use client';

import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { FiLogOut } from 'react-icons/fi';

export function StopImpersonationButton() {
  const router = useRouter();

  const handleStop = async () => {
    try {
      const res = await fetch('/api/admin/impersonate/stop', {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Impersonation terminée');
        router.push('/admin');
        router.refresh();
      } else {
        toast.error(data.message || 'Erreur');
      }
    } catch {
      toast.error('Erreur serveur');
    }
  };

  return (
    <button onClick={handleStop} className="sidebar-link w-full text-warning-400 hover:text-warning-300 hover:bg-warning-500/10">
      <FiLogOut className="w-5 h-5" />
      Arrêter l&apos;impersonation
    </button>
  );
}
