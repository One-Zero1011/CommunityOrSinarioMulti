
import React, { useState, useRef, useEffect } from 'react';
import { Character, ChatMessage } from '../../types';
import { Plus, Trash2, Heart, Upload, User, Shield, MessageSquare, Send, Lock } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { blobToBase64 } from '../../lib/utils';

interface PlayerSidebarProps {
  characters: Character[];
  activeCharId: string;
  chatMessages: ChatMessage[];
  isAdmin: boolean;
  onSelectChar: (id: string) => void;
  onAddChar: () => void;
  onUpdateChar: (id: string, updates: Partial<Character>) => void;
  onDeleteChar: (id: string) => void;
  onSendMessage: (text: string) => void;
  onAdminLogin: (key: string) => void;
}

export const PlayerSidebar: React.FC<PlayerSidebarProps> = ({
  characters,
  activeCharId,
  chatMessages,
  isAdmin,
  onSelectChar,
  onAddChar,
  onUpdateChar,
  onDeleteChar,
  onSendMessage,
  onAdminLogin
}) => {
  const [activeTab, setActiveTab] = useState<'CHAR' | 'CHAT'>('CHAR');
  const [inputText, setInputText] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleAvatarUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      try {
        // Convert to Base64 so it works across the network
        const base64 = await blobToBase64(e.target.files[0]);
        onUpdateChar(id, { avatar: base64 });
      } catch (err) {
        console.error("Failed to convert image", err);
      }
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText("");
    }
  };

  const attemptLogin = () => {
      onAdminLogin(adminKeyInput);
      setAdminKeyInput("");
      setShowAdminLogin(false);
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (activeTab === 'CHAT') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  return (
    <>
        <div className="w-80 bg-[#1a1a1a] border-l border-[#444] flex flex-col h-full shadow-2xl z-20">
        {/* Tabs */}
        <div className="flex border-b border-[#444] relative">
            <button 
            onClick={() => setActiveTab('CHAR')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'CHAR' ? 'bg-[#222] text-white border-b-2 border-indigo-500' : 'bg-[#1a1a1a] text-gray-500 hover:text-gray-300'}`}
            >
            <Shield size={16} /> 탐사자
            </button>
            <button 
            onClick={() => setActiveTab('CHAT')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'CHAT' ? 'bg-[#222] text-white border-b-2 border-indigo-500' : 'bg-[#1a1a1a] text-gray-500 hover:text-gray-300'}`}
            >
            <MessageSquare size={16} /> 채팅
            {activeTab !== 'CHAT' && chatMessages.length > 0 && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
            </button>
            
            {/* Admin Login Button (Tiny Lock) */}
            {!isAdmin && (
                <button 
                    onClick={() => setShowAdminLogin(true)}
                    className="absolute right-0 top-0 h-full px-2 text-gray-600 hover:text-orange-500 transition-colors"
                    title="운영자 로그인"
                >
                    <Lock size={14} />
                </button>
            )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
            
            {/* -- Character List Tab -- */}
            {activeTab === 'CHAR' && (
            <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {characters.map((char) => {
                    const isActive = char.id === activeCharId;
                    return (
                    <div 
                        key={char.id}
                        onClick={() => onSelectChar(char.id)}
                        className={`relative rounded-lg p-3 transition-all border-2 cursor-pointer group ${
                        isActive 
                            ? 'bg-[#2e2e2e] border-indigo-500 shadow-lg shadow-indigo-900/20' 
                            : 'bg-[#252525] border-[#333] hover:border-gray-500'
                        }`}
                    >
                        <div className="flex gap-3">
                        {/* Avatar Section */}
                        <div className="shrink-0">
                            <label className="block w-16 h-16 rounded bg-[#111] border border-[#444] overflow-hidden relative cursor-pointer hover:opacity-80 transition-opacity group/avatar">
                            {char.avatar ? (
                                <img src={char.avatar} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-600">
                                <User size={24} />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                                <Upload size={16} className="text-white" />
                            </div>
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => handleAvatarUpload(char.id, e)}
                            />
                            </label>
                        </div>

                        {/* Info Section */}
                        <div className="flex-1 min-w-0 space-y-1">
                            <input 
                                type="text" 
                                value={char.name}
                                onChange={(e) => onUpdateChar(char.id, { name: e.target.value })}
                                className="w-full bg-transparent border-b border-transparent hover:border-gray-600 focus:border-indigo-500 focus:bg-[#1a1a1a] outline-none text-sm font-bold text-gray-100 placeholder-gray-600 px-1 rounded transition-colors"
                                placeholder="이름"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <input 
                                type="text" 
                                value={char.desc || ''}
                                onChange={(e) => onUpdateChar(char.id, { desc: e.target.value })}
                                className="w-full bg-transparent border-b border-transparent hover:border-gray-600 focus:border-indigo-500 focus:bg-[#1a1a1a] outline-none text-xs text-gray-400 placeholder-gray-600 px-1 rounded transition-colors"
                                placeholder="설명 (성별, 나이 등)"
                                onClick={(e) => e.stopPropagation()}
                            />
                            
                            <div className="flex items-center gap-2 pt-1">
                                <Heart size={12} className={char.hp < 30 ? "text-red-500 animate-pulse" : "text-emerald-500"} />
                                <div className="flex items-center gap-1 bg-[#1a1a1a] rounded px-1 border border-[#333]">
                                <input 
                                    type="number"
                                    value={char.hp}
                                    onChange={(e) => onUpdateChar(char.id, { hp: parseInt(e.target.value) || 0 })}
                                    className="w-8 bg-transparent text-right text-xs outline-none text-gray-200"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-[10px] text-gray-500">/</span>
                                <input 
                                    type="number"
                                    value={char.maxHp}
                                    onChange={(e) => onUpdateChar(char.id, { maxHp: parseInt(e.target.value) || 100 })}
                                    className="w-8 bg-transparent text-left text-xs outline-none text-gray-500"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                </div>
                            </div>
                        </div>
                        </div>

                        {/* Inventory */}
                        <div className="mt-3 pt-2 border-t border-[#333]">
                        <p className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">인벤토리</p>
                        {char.inventory.length === 0 ? (
                            <p className="text-[10px] text-gray-600 italic">비어있음</p>
                        ) : (
                            <div className="flex flex-wrap gap-1">
                            {char.inventory.map((item, idx) => (
                                <span key={idx} className="text-[10px] bg-[#333] text-gray-300 px-1.5 py-0.5 rounded border border-[#444]">
                                {item}
                                </span>
                            ))}
                            </div>
                        )}
                        </div>

                        {/* Delete Button */}
                        {characters.length > 1 && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteChar(char.id); }}
                            className="absolute top-2 right-2 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            title="삭제"
                        >
                            <Trash2 size={14} />
                        </button>
                        )}
                    </div>
                    );
                })}
                </div>
                <div className="p-4 border-t border-[#444] bg-[#222]">
                <button 
                    onClick={onAddChar}
                    className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 rounded flex items-center justify-center gap-2 shadow-lg transition-colors text-sm"
                >
                    <Plus size={16} /> 캐릭터 추가
                </button>
                </div>
            </div>
            )}

            {/* -- Chat Tab -- */}
            {activeTab === 'CHAT' && (
            <div className="h-full flex flex-col bg-[#111]">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.length === 0 && (
                    <div className="text-center text-gray-600 text-xs mt-4">
                    채팅 기록이 없습니다.
                    </div>
                )}
                {chatMessages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.isSystem ? 'items-center my-2' : 'items-start'}`}>
                    {msg.isSystem ? (
                        <div className="bg-[#2a2a2a] text-gray-400 text-[10px] px-2 py-1 rounded-full border border-[#333]">
                        {msg.text}
                        </div>
                    ) : (
                        <div className="w-full">
                        <span className="text-[10px] font-bold text-gray-400 block mb-0.5">{msg.senderName}</span>
                        <div className="bg-[#2e2e2e] text-gray-200 text-sm px-3 py-2 rounded-lg rounded-tl-none border border-[#333] break-words">
                            {msg.text}
                        </div>
                        </div>
                    )}
                    </div>
                ))}
                <div ref={chatEndRef} />
                </div>
                
                <form onSubmit={handleSend} className="p-3 bg-[#222] border-t border-[#444]">
                <div className="relative">
                    <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full bg-[#111] border border-[#333] rounded-full pl-4 pr-10 py-2 text-sm text-gray-200 focus:border-indigo-500 outline-none"
                    placeholder="메시지 입력..."
                    />
                    <button 
                    type="submit"
                    className="absolute right-1 top-1 bottom-1 bg-indigo-600 hover:bg-indigo-500 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    >
                    <Send size={14} />
                    </button>
                </div>
                </form>
            </div>
            )}

        </div>
        </div>

        {/* Admin Login Modal */}
        <Modal 
            isOpen={showAdminLogin} 
            onClose={() => setShowAdminLogin(false)} 
            title="운영자 로그인"
            maxWidth="max-w-sm"
            footer={<Button variant="primary" onClick={attemptLogin}>로그인</Button>}
        >
            <div className="p-4 text-center">
                <div className="w-12 h-12 bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-orange-500/50">
                    <Lock className="text-orange-500" size={24} />
                </div>
                <p className="text-gray-400 text-sm mb-4">
                    시나리오에 설정된 운영자 키를 입력하세요.
                </p>
                <input 
                    type="password"
                    value={adminKeyInput}
                    onChange={(e) => setAdminKeyInput(e.target.value)}
                    className="w-full bg-[#333] border border-[#555] rounded px-4 py-2 text-white focus:border-orange-500 outline-none text-center tracking-widest"
                    placeholder="KEY"
                    onKeyDown={(e) => e.key === 'Enter' && attemptLogin()}
                />
            </div>
        </Modal>
    </>
  );
};
