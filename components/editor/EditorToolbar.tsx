
import React, { useRef } from 'react';
import { ObjectType } from '../../types';
import { MousePointer2, Image as ImageIcon, Upload } from 'lucide-react';
import { blobToBase64 } from '../../lib/utils';

interface EditorToolbarProps {
  mapName: string;
  onAddObject: (type: ObjectType) => void;
  onBackgroundUpload: (file: File) => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ mapName, onAddObject, onBackgroundUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      // Base64로 변환하여 상위 컴포넌트로 전달 (URL.createObjectURL 대체)
      // onBackgroundUpload prop의 타입 정의는 File을 받지만, Editor.tsx에서 변환 로직을 수정하는 대신 여기서 처리해도 되나, 
      // 상위 컴포넌트(Editor)에서 처리를 일원화하기 위해 여기서는 그대로 전달하되, 
      // Editor.tsx의 handleBackgroundUpload를 수정하거나, 여기서 직접 blobToBase64를 호출하고 상위 인터페이스를 바꿀 수 있음.
      // 가장 안전하게 여기서 바로 처리해서 Editor로 넘기려면 Editor.tsx의 onBackgroundUpload 타입을 string으로 바꾸거나 해야함.
      // 하지만 가장 간단한 수정은 Editor.tsx에서 변환하는 것이나, 이 컴포넌트가 UI 담당이므로, 
      // 기존 코드를 유지하되 파일 자체를 넘기고 Editor.tsx에서 Base64 변환을 수행하도록 유도. 
      // 그러나 XML 수정 요청상 Editor.tsx도 수정해야 함.
      // 더 나은 방법: Editor.tsx에서 처리. 이 파일은 롤백하고 Editor.tsx와 ObjectInspector.tsx를 수정.
      
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
