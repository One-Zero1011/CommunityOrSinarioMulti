
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'host' | 'join';
  icon?: LucideIcon;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, variant = 'primary', icon: Icon, fullWidth = false, className = '', ...props 
}) => {
  const baseStyles = "font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg",
    secondary: "bg-[#383838] hover:bg-[#4a4a4a] text-gray-200 border border-[#555]",
    danger: "bg-red-600 hover:bg-red-500 text-white",
    ghost: "bg-transparent hover:bg-white/10 text-gray-400 hover:text-white",
    host: "bg-orange-700 hover:bg-orange-600 text-white shadow-lg",
    join: "bg-blue-700 hover:bg-blue-600 text-white shadow-lg",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`} 
      {...props}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};
