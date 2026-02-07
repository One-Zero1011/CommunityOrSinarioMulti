
import React from 'react';
import { MapObject } from '../../types';
import { Modal } from '../common/Modal';
import { Dices, FileText, ArrowRightCircle, MessageSquare } from 'lucide-react';

interface ActionSelectionModalProps {
    object: MapObject;
    onSelect: (actionType: 'INSPECT' | 'BASIC' | 'MOVE' | 'CUSTOM', subActionId?: string) => void;
    onClose: () => void;
}

export const ActionSelectionModal: React.FC<ActionSelectionModalProps> = ({ object, onSelect, onClose }) => {
    
    // Determine available actions
    const hasInspect = object.useProbability;
    const hasBasic = !!object.description && object.description.trim() !== "";
    const hasMove = !!object.targetMapId && !hasInspect; // If inspection exists, move is usually handled by outcome
    const customActions = object.subActions || [];

    return (
        <Modal isOpen={true} onClose={onClose} title={`"${object.label}" 행동 선택`} maxWidth="max-w-lg">
            <div className="p-2 space-y-4">
                <p className="text-gray-400 text-sm text-center mb-4">어떤 행동을 하시겠습니까?</p>
                
                <div className="grid grid-cols-1 gap-3">
                    {hasInspect && (
                        <button 
                            onClick={() => onSelect('INSPECT')}
                            className="bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-500/50 p-4 rounded-xl flex items-center gap-4 transition-all hover:scale-[1.02] group"
                        >
                            <div className="bg-indigo-600 p-3 rounded-full group-hover:scale-110 transition-transform shadow-lg">
                                <Dices size={24} className="text-white" />
                            </div>
                            <div className="text-left">
                                <h4 className="text-indigo-300 font-bold text-lg">살핀다 (Inspect)</h4>
                                <p className="text-gray-400 text-xs">주사위를 굴려 대상을 자세히 조사합니다.</p>
                            </div>
                        </button>
                    )}

                    {hasBasic && (
                        <button 
                            onClick={() => onSelect('BASIC')}
                            className="bg-gray-800/40 hover:bg-gray-700/60 border border-gray-600/50 p-4 rounded-xl flex items-center gap-4 transition-all hover:scale-[1.02] group"
                        >
                            <div className="bg-gray-600 p-3 rounded-full group-hover:scale-110 transition-transform shadow-lg">
                                <FileText size={24} className="text-white" />
                            </div>
                            <div className="text-left">
                                <h4 className="text-gray-200 font-bold text-lg">기본 확인 (Basic)</h4>
                                <p className="text-gray-400 text-xs">대상의 기본적인 외형이나 설명을 봅니다.</p>
                            </div>
                        </button>
                    )}

                    {customActions.map(action => (
                        <button 
                            key={action.id}
                            onClick={() => onSelect('CUSTOM', action.id)}
                            className="bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/50 p-4 rounded-xl flex items-center gap-4 transition-all hover:scale-[1.02] group"
                        >
                            <div className="bg-emerald-600 p-3 rounded-full group-hover:scale-110 transition-transform shadow-lg">
                                <MessageSquare size={24} className="text-white" />
                            </div>
                            <div className="text-left">
                                <h4 className="text-emerald-300 font-bold text-lg">{action.label}</h4>
                                <p className="text-gray-400 text-xs">특정 행동을 수행합니다.</p>
                            </div>
                        </button>
                    ))}

                    {hasMove && (
                        <button 
                            onClick={() => onSelect('MOVE')}
                            className="bg-blue-900/40 hover:bg-blue-800/60 border border-blue-500/50 p-4 rounded-xl flex items-center gap-4 transition-all hover:scale-[1.02] group"
                        >
                            <div className="bg-blue-600 p-3 rounded-full group-hover:scale-110 transition-transform shadow-lg">
                                <ArrowRightCircle size={24} className="text-white" />
                            </div>
                            <div className="text-left">
                                <h4 className="text-blue-300 font-bold text-lg">이동 (Move)</h4>
                                <p className="text-gray-400 text-xs">다음 장소로 이동합니다.</p>
                            </div>
                        </button>
                    )}
                </div>
                
                <button onClick={onClose} className="w-full text-center text-gray-500 text-xs hover:text-white mt-4 underline">취소</button>
            </div>
        </Modal>
    );
};
