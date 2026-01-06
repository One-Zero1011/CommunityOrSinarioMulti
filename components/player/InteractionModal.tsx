
import React, { useState } from 'react';
import { OutcomeDef, ResultType } from '../../types';
import { getResultColor, getResultLabel } from '../../lib/game-logic';
import { Clipboard, FileText, ArrowRightCircle } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

interface InteractionResultData {
  hasRoll: boolean;
  type?: ResultType;
  outcome?: OutcomeDef;
  description?: string;
  objectName: string;
  targetMapId?: string;
  targetMapName?: string;
}

interface InteractionModalProps {
  data: InteractionResultData;
  characterName: string;
  onClose: () => void;
  onMove: (mapId: string) => void;
}

export const InteractionModal: React.FC<InteractionModalProps> = ({ data, characterName, onClose, onMove }) => {
  const [rpText, setRpText] = useState("");

  const copyToClipboard = () => {
    let text = `[${characterName}] 의 "${data.objectName}" 조사 결과\n`;
    if (data.description) text += `▶ 내용: ${data.description}\n`;
    if (data.hasRoll && data.type && data.outcome) {
        text += `▶ 판정: ${getResultLabel(data.type)}\n`;
        text += `▶ 시스템: ${data.outcome.text}\n`;
        if (data.outcome.hpChange !== 0) text += `(HP ${data.outcome.hpChange > 0 ? '+' : ''}${data.outcome.hpChange})\n`;
        if (data.outcome.itemDrop) text += `(획득: ${data.outcome.itemDrop})\n`;
    }
    if (data.targetMapName) text += `▶ 이동: ${data.targetMapName}\n`;
    text += `\n"${rpText}"`;

    navigator.clipboard.writeText(text.trim());
    alert("로그가 클립보드에 복사되었습니다!");
  };

  const footerContent = (
    <>
      <Button variant="ghost" onClick={onClose}>닫기</Button>
      <Button variant="secondary" onClick={copyToClipboard} icon={Clipboard}>로그 복사</Button>
      {data.targetMapId && (
         <Button variant="primary" onClick={() => onMove(data.targetMapId!)} icon={ArrowRightCircle}>
            {data.targetMapName} 이동
         </Button>
      )}
    </>
  );

  return (
    <Modal
        isOpen={true}
        onClose={onClose}
        title={`조사: ${data.objectName}`}
        footer={footerContent}
    >
        <div className="space-y-4">
            {data.description && (
                <div className="bg-[#383838] p-4 rounded border border-[#555] flex gap-3">
                    <div className="mt-1 text-indigo-400"><FileText size={20} /></div>
                    <div className="text-gray-200 whitespace-pre-wrap leading-relaxed text-sm">{data.description}</div>
                </div>
            )}

            {data.hasRoll && data.type && data.outcome && (
            <div className="bg-[#1e1e1e] p-4 rounded border border-[#444] shadow-inner">
                <h4 className={`font-bold mb-2 flex items-center gap-2 text-lg ${getResultColor(data.type)}`}>
                    {getResultLabel(data.type)}
                </h4>
                <p className="text-gray-300 italic mb-3 text-sm">{data.outcome.text}</p>
                <div className="flex gap-4 text-sm font-mono mt-3 border-t border-[#444] pt-2">
                {data.outcome.hpChange !== 0 && (
                    <span className={data.outcome.hpChange > 0 ? "text-green-400" : "text-red-400"}>
                    HP {data.outcome.hpChange > 0 ? '+' : ''}{data.outcome.hpChange}
                    </span>
                )}
                {data.outcome.itemDrop && (
                    <span className="text-amber-400">
                    획득: {data.outcome.itemDrop}
                    </span>
                )}
                </div>
            </div>
            )}
            
            {data.targetMapId && data.targetMapName && (
                <div className="bg-indigo-900/30 p-4 rounded border border-indigo-500/50 flex items-center gap-3">
                    <div className="text-indigo-400"><ArrowRightCircle size={24} /></div>
                    <div>
                        <p className="text-sm text-indigo-200 font-bold">이동 가능</p>
                        <p className="text-xs text-gray-300">다음 장소로 이동할 수 있습니다: <span className="text-white font-bold">{data.targetMapName}</span></p>
                    </div>
                </div>
            )}

            <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase font-bold tracking-wider">로그 작성 (RP)</label>
                <textarea 
                    className="w-full h-32 bg-[#383838] border border-[#555] rounded p-3 text-gray-200 focus:border-indigo-500 outline-none resize-none transition-colors"
                    placeholder="캐릭터의 행동이나 대사를 입력하세요..."
                    value={rpText}
                    onChange={(e) => setRpText(e.target.value)}
                ></textarea>
            </div>
        </div>
    </Modal>
  );
};
