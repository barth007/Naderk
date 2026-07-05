import React from 'react';
import { Button } from '@/components/ui/button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText: string;
  isPending: boolean;
  confirmButtonVariant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  isPending,
  confirmButtonVariant = "default"
}: ConfirmationModalProps) {
  return (
    <dialog className={`modal ${isOpen ? 'modal-open' : ''}`}>
      <div className="modal-box w-full max-w-sm rounded-xl bg-white">
        <h3 className="font-bold text-lg text-gray-900">{title}</h3>
        <p className="py-4 text-gray-600 text-sm">{description}</p>
        <div className="modal-action">
          <Button 
            variant="outline"
            onClick={onClose}
            className="text-[#E03E3E] hover:text-[#E03E3E] font-bold border-[#E03E3E] hover:border-[#E03E3E] hover:bg-[#FEF6F6]"
          >
            Close
          </Button>
          <Button 
            variant={confirmButtonVariant}
            onClick={onConfirm} 
            disabled={isPending}
            isLoading={isPending}
            loadingText="Processing..."
            className="font-bold"
          >
            {confirmText}
          </Button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
