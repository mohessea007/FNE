'use client';

import { FiCopy } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface CopyApiKeyButtonProps {
  apiKey: string;
}

export function CopyApiKeyButton({ apiKey }: CopyApiKeyButtonProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success('Clé API copiée !');
  };

  return (
    <button onClick={handleCopy} className="btn-secondary btn-sm">
      <FiCopy className="w-4 h-4" /> Copier
    </button>
  );
}

