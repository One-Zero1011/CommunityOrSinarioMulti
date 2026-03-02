
import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ title, isOpen, onClose, children, footer, maxWidth = 'max-w-2xl' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
       <div className={`bg-[#2e2e2e] border border-[#555] w-full ${maxWidth} rounded-lg shadow-2xl flex flex-col max-h-[90vh] animate-fade-in`}>
          <div className="p-4 border-b border-[#555] flex justify-between items-center bg-[#252525] rounded-t-lg shrink-0">
            <h3 className="font-bold text-lg text-white">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 overflow-y-auto custom-scrollbar">
             {children}
          </div>
          {footer && (
            <div className="p-4 border-t border-[#555] bg-[#252525] rounded-b-lg flex justify-end gap-3 shrink-0">
               {footer}
            </div>
          )}
       </div>
    </div>
  );
};
