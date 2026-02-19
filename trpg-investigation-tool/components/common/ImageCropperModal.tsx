
import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Maximize, Move, Square, Circle, Smartphone, Monitor } from 'lucide-react';
import { Button } from './Button';

export type CropShape = 'RECTANGLE' | 'ROUNDED' | 'CIRCLE';

interface ImageCropperModalProps {
  isOpen: boolean;
  file: File | null;
  initialAspectRatio?: number | null; // null for free
  initialShape?: CropShape;
  onClose: () => void;
  onConfirm: (base64: string) => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({ 
  isOpen, file, initialAspectRatio = null, initialShape = 'RECTANGLE', onClose, onConfirm 
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 200, height: 200 });
  
  // Settings State
  const [aspectRatio, setAspectRatio] = useState<number | null>(initialAspectRatio);
  const [cropShape, setCropShape] = useState<CropShape>(initialShape);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0, cropX: 0, cropY: 0, cropW: 0, cropH: 0 });

  // 파일 로드 및 초기화
  useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setAspectRatio(initialAspectRatio);
        setCropShape(initialShape);
        
        // Reset crop box defaults based on ratio
        const w = 200;
        const h = initialAspectRatio ? w / initialAspectRatio : 200;
        setCrop({ x: 50, y: 50, width: w, height: h });
      };
      reader.readAsDataURL(file);
    } else {
      setImageSrc(null);
    }
  }, [file, initialAspectRatio, initialShape]);

  // 비율 변경 핸들러
  const handleRatioChange = (ratio: number | null) => {
      setAspectRatio(ratio);
      if (ratio) {
          // Apply ratio immediately to current width
          const newH = crop.width / ratio;
          // Boundary Check needed in real app, simplistic here
          setCrop(prev => ({ ...prev, height: newH }));
      }
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'MOVE' | 'RESIZE') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'MOVE') setIsDragging(true);
    else setIsResizing(true);

    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      cropX: crop.x,
      cropY: crop.y,
      cropW: crop.width,
      cropH: crop.height
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging && !isResizing) return;
    if (!containerRef.current || !imgRef.current) return;

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const imgRect = imgRef.current.getBoundingClientRect();
    const displayWidth = imgRect.width;
    const displayHeight = imgRect.height;

    if (isDragging) {
      let newX = dragStart.current.cropX + dx;
      let newY = dragStart.current.cropY + dy;

      newX = Math.max(0, Math.min(newX, displayWidth - crop.width));
      newY = Math.max(0, Math.min(newY, displayHeight - crop.height));

      setCrop(prev => ({ ...prev, x: newX, y: newY }));
    } 
    
    if (isResizing) {
      let newW = Math.max(50, dragStart.current.cropW + dx);
      let newH = Math.max(50, dragStart.current.cropH + dy);

      // Enforce Aspect Ratio
      if (aspectRatio) {
          newH = newW / aspectRatio;
      }

      // Boundary Check (Width)
      if (crop.x + newW > displayWidth) {
          newW = displayWidth - crop.x;
          if (aspectRatio) newH = newW / aspectRatio;
      }
      
      // Boundary Check (Height)
      if (crop.y + newH > displayHeight) {
          newH = displayHeight - crop.y;
          if (aspectRatio) newW = newH * aspectRatio;
      }

      setCrop(prev => ({ ...prev, width: newW, height: newH }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const handleCropConfirm = () => {
    if (!imgRef.current) return;

    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle Circle/Rounded Masking
    if (cropShape === 'CIRCLE') {
        ctx.beginPath();
        ctx.ellipse(
            canvas.width / 2, canvas.height / 2, 
            canvas.width / 2, canvas.height / 2, 
            0, 0, 2 * Math.PI
        );
        ctx.clip();
    } else if (cropShape === 'ROUNDED') {
        const r = Math.min(canvas.width, canvas.height) * 0.2; // 20% radius
        ctx.beginPath();
        ctx.roundRect(0, 0, canvas.width, canvas.height, r);
        ctx.clip();
    }

    ctx.drawImage(
      imgRef.current,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const base64 = canvas.toDataURL('image/png');
    onConfirm(base64);
    onClose();
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-4 backdrop-blur-sm"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="bg-[#2e2e2e] w-full max-w-4xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-[#444] flex justify-between items-center bg-[#252525]">
          <h3 className="font-bold text-lg text-white">이미지 편집</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden relative bg-[#111] flex items-center justify-center p-8 select-none" ref={containerRef}>
            <div className="relative inline-block shadow-2xl">
                <img 
                    ref={imgRef}
                    src={imageSrc} 
                    alt="Original" 
                    className="max-h-[50vh] max-w-full object-contain pointer-events-none block"
                    draggable={false}
                />
                
                <div className="absolute inset-0 bg-black/60 pointer-events-none"></div>

                {/* Crop Box */}
                <div 
                    className="absolute cursor-move shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] outline outline-2 outline-white"
                    style={{
                        left: crop.x,
                        top: crop.y,
                        width: crop.width,
                        height: crop.height,
                        borderRadius: cropShape === 'CIRCLE' ? '50%' : (cropShape === 'ROUNDED' ? '1rem' : '0')
                    }}
                    onMouseDown={(e) => handleMouseDown(e, 'MOVE')}
                >
                    {/* Transparent Hole visual fix is handled by shadow above, but we can add an inner helper */}
                    <div className="w-full h-full overflow-hidden relative">
                         <img 
                            src={imageSrc} 
                            alt="" 
                            className="absolute pointer-events-none max-w-none"
                            style={{
                                width: imgRef.current?.width,
                                height: imgRef.current?.height,
                                left: -crop.x,
                                top: -crop.y
                            }}
                         />
                         
                         {/* Grid Lines */}
                         <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                            <div className="border-r border-b border-white/50" />
                            <div className="border-r border-b border-white/50" />
                            <div className="border-b border-white/50" />
                            <div className="border-r border-b border-white/50" />
                            <div className="border-r border-b border-white/50" />
                            <div className="border-b border-white/50" />
                            <div className="border-r border-white/50" />
                            <div className="border-r border-white/50" />
                            <div />
                        </div>
                    </div>

                    {/* Resize Handle (Bottom Right) */}
                    <div 
                        className="absolute bottom-0 right-0 w-6 h-6 bg-white cursor-nwse-resize flex items-center justify-center text-black z-10 translate-x-2 translate-y-2 rounded-full shadow-lg hover:scale-110 transition-transform"
                        onMouseDown={(e) => handleMouseDown(e, 'RESIZE')}
                    >
                        <Maximize size={14} />
                    </div>
                </div>
            </div>
        </div>
        
        {/* Toolbar */}
        <div className="bg-[#1e1e1e] p-2 border-t border-[#444] flex flex-wrap items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-1 bg-[#2e2e2e] p-1 rounded border border-[#444]">
                <span className="px-2 font-bold text-gray-400">비율</span>
                <button onClick={() => handleRatioChange(null)} className={`px-2 py-1 rounded ${!aspectRatio ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-[#383838]'}`}>자유</button>
                <button onClick={() => handleRatioChange(1)} className={`px-2 py-1 rounded ${aspectRatio === 1 ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-[#383838]'}`}>1:1</button>
                <button onClick={() => handleRatioChange(4/3)} className={`px-2 py-1 rounded ${aspectRatio === 4/3 ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-[#383838]'}`}>4:3</button>
                <button onClick={() => handleRatioChange(16/9)} className={`px-2 py-1 rounded ${aspectRatio === 16/9 ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-[#383838]'}`}>16:9</button>
            </div>
            
            <div className="flex items-center gap-1 bg-[#2e2e2e] p-1 rounded border border-[#444]">
                <span className="px-2 font-bold text-gray-400">모양</span>
                <button onClick={() => setCropShape('RECTANGLE')} className={`p-1.5 rounded ${cropShape === 'RECTANGLE' ? 'bg-emerald-600 text-white' : 'text-gray-300 hover:bg-[#383838]'}`} title="사각형"><Square size={14} /></button>
                <button onClick={() => setCropShape('ROUNDED')} className={`p-1.5 rounded ${cropShape === 'ROUNDED' ? 'bg-emerald-600 text-white' : 'text-gray-300 hover:bg-[#383838]'}`} title="둥근 사각형"><Smartphone size={14} /></button>
                <button onClick={() => { setCropShape('CIRCLE'); handleRatioChange(1); }} className={`p-1.5 rounded ${cropShape === 'CIRCLE' ? 'bg-emerald-600 text-white' : 'text-gray-300 hover:bg-[#383838]'}`} title="원형"><Circle size={14} /></button>
            </div>
        </div>

        <div className="p-4 border-t border-[#444] bg-[#252525] flex justify-end gap-2">
           <Button variant="ghost" onClick={onClose}>취소</Button>
           <Button variant="primary" onClick={handleCropConfirm} icon={Check}>적용하기</Button>
        </div>
      </div>
    </div>
  );
};
