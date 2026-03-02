
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatInputProps {
    label: string;
    value: number;
    onChange: (v: number) => void;
    icon: LucideIcon;
    color: string;
    disabled?: boolean;
}

export const StatInput: React.FC<StatInputProps> = ({ label, value, onChange, icon: Icon, color, disabled = false }) => (
    <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded flex items-center justify-center ${color} text-white shadow-sm shrink-0`}>
            <Icon size={16} />
        </div>
        <div className="flex-1">
            <div className="flex justify-between text-xs mb-1 text-gray-300 font-bold">
                <span>{label}</span>
                <span>{value} / 5</span>
            </div>
            <input 
                type="range" 
                min="1" 
                max="5" 
                step="1"
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className={`w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={disabled}
            />
        </div>
    </div>
);
