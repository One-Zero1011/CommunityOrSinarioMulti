import React, { useRef } from 'react';
import { ObjectType } from '../../types';
import { MousePointer2, Image as ImageIcon, Upload } from 'lucide-react';

interface EditorToolbarProps {
  mapName: string;
  onAddObject: (type: ObjectType) => void;
  onBackgroundUpload: (file: File) => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ mapName, onAddObject, onBackgroundUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      onBackgroundUpload(e.target.files[0]);
    }
  };

  return (
    <div className="h-12 bg-[#252525] border-b border-[#444] flex items-center px-4 space-x-4 text-gray-200">
      <div className="font-bold mr-4 text-gray-100">{mapName}</div>
      <div className="h-6 w-px bg-[#444] mx-2"></div>
      
      <button onClick={() => onAddObject('OBJECT')} className="flex items-center gap-1 text-sm bg-emerald-800 hover:bg-emerald-700 px-3 py-1 rounded text-white shadow-sm">
         <MousePointer2 size={14} /> 상호작용 (조사/이동)
      </button>
      
      <button onClick={() => onAddObject('DECORATION')} className="flex items-center gap-1 text-sm bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-white shadow-sm">
         <ImageIcon size={14} /> 장식
      </button>
      
      <div className="h-6 w-px bg-[#444] mx-2"></div>
      
      <button 
         onClick={() => fileInputRef.current?.click()} 
         className="flex items-center gap-1 text-sm bg-[#383838] hover:bg-[#4a4a4a] px-3 py-1 rounded text-gray-200"
         title="배경 이미지 설정"
      >
         <Upload size={14} /> 배경
      </button>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />
    </div>
  );
};