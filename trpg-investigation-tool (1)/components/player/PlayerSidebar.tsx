
import React, { useState, useRef, useEffect } from 'react';
import { Character, ChatMessage, MapObject, CustomStatDef } from '../../types';
import { Plus, Trash2, Heart, Upload, User, Shield, MessageSquare, Send, Lock, Megaphone, Radio, MapPin, Users, Layers, Eye, EyeOff, Activity } from 'lucide-react';
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
  onSendAnnouncement?: (targetId: string | null, title: string, message: string) => void;
  onSummonPlayer?: (targetId: string | 'ALL') => void;
  currentMapObjects?: MapObject[];
  onToggleVisibility?: (mapId: string, objectId: string, hidden: boolean) => void;
  currentMapId: string;
  customStats?: CustomStatDef[];
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
  onAdminLogin,
  onSendAnnouncement,
  onSummonPlayer,
  currentMapObjects = [],
  onToggleVisibility,
  currentMapId,
  customStats = []
}) => {
  const [activeTab, setActiveTab] = useState<'CHAR' | 'CHAT' | 'ADMIN'>('CHAR');
  const [inputText, setInputText] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState("");
  
  const [announceTitle, setAnnounceTitle] = useState("");
  const [announceMsg, setAnnounceMsg] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleAvatarUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      try {
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

  const handleSendAnnouncement = (targetId: string | null) => {
      if (!onSendAnnouncement) return;
      if (!announceTitle.trim() || !announceMsg.trim()) {
          alert("공지 제목과 내용을 입력해주세요.");
          return;
      }
      onSendAnnouncement(targetId, announceTitle, announceMsg);
      alert("공지가 전송되었습니다.");
      setAnnounceTitle("");
      setAnnounceMsg("");
  };

  useEffect(() => {
    if (activeTab === 'CHAT') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  return (
    <>
        <div className="w-80 bg-[#1a1a1a] border-l border-[#444] flex flex-col h-full shadow-2xl z-20">
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
            {isAdmin && (
                <button 
                onClick={() => setActiveTab('ADMIN')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'ADMIN' ? 'bg-[#222] text-orange-400 border-b-2 border-orange-500' : 'bg-[#1a1a1a] text-gray-500 hover:text-gray-300'}`}
                >
                <Lock size={16} /> 관리
                </button>
            )}
            
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

        <div className="flex-1 overflow-hidden relative">
            
            {activeTab === 'CHAR' && (
            <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {characters.length === 0 && (
                    <p className="text-xs text-gray-600 italic text-center mt-10">생성된 탐사자가 없습니다.</p>
                )}
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

                        <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-1">
                                <input 
                                    type="text" 
                                    value={char.name}
                                    onChange={(e) => onUpdateChar(char.id, { name: e.target.value })}
                                    className="w-full bg-transparent border-b border-transparent hover:border-gray-600 focus:border-indigo-500 focus:bg-[#1a1a1a] outline-none text-sm font-bold text-gray-100 placeholder-gray-600 px-1 rounded transition-colors"
                                    placeholder="이름"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                            <input 
                                type="text" 
                                value={char.desc || ''}
                                onChange={(e) => onUpdateChar(char.id, { desc: e.target.value })}
                                className="w-full bg-transparent border-b border-transparent hover:border-gray-600 focus:border-indigo-500 focus:bg-[#1a1a1a] outline-none text-xs text-gray-400 placeholder-gray-600 px-1 rounded transition-colors"
                                placeholder="설명"
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

                        {/* Custom Stats Display */}
                        {char.stats && Object.keys(char.stats).length > 0 && (
                            <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-[#333] pt-2">
                                {Object.entries(char.stats).map(([sid, val]) => {
                                    const def = customStats.find(s => s.id === sid);
                                    if(!def) return null;
                                    return (
                                        <div key={sid} className="flex justify-between items-center bg-[#1a1a1a] px-2 py-0.5 rounded border border-[#333]">
                                            <span className="text-[10px] text-gray-500 font-bold">{def.label}</span>
                                            <span className="text-[10px] text-indigo-400 font-mono font-bold">{val}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

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

                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteChar(char.id); }}
                            className="absolute top-2 right-2 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            title="삭제"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                    );
                })}
                </div>
                <div className="p-4 border-t border-[#444] bg-[#222]">
                <button 
                    onClick={onAddChar}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded flex items-center justify-center gap-2 shadow-lg transition-colors text-sm"
                >
                    <Plus size={16} /> 탐사자 추가
                </button>
                </div>
            </div>
            )}

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
                        <div className={`bg-[#2e2e2e] text-gray-200 text-sm px-3 py-2 rounded-lg rounded-tl-none border border-[#333] break-words ${msg.senderName.includes('GM') ? 'border-orange-500/50 bg-orange-950/20' : ''}`}>
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

            {activeTab === 'ADMIN' && isAdmin && (
                <div className="h-full flex flex-col bg-[#1e1e1e] p-4 overflow-y-auto space-y-4">
                    <div className="bg-[#2a2a2a] p-3 rounded border border-[#444]">
                        <h4 className="text-xs font-bold text-orange-400 uppercase mb-3 flex items-center gap-2">
                            <Megaphone size={14} /> 시스템 공지 발송
                        </h4>
                        <input 
                            type="text" 
                            value={announceTitle}
                            onChange={(e) => setAnnounceTitle(e.target.value)}
                            placeholder="공지 제목"
                            className="w-full bg-[#333] border border-[#555] rounded px-2 py-1.5 text-xs text-white mb-2 focus:border-orange-500 outline-none"
                        />
                        <textarea 
                            value={announceMsg}
                            onChange={(e) => setAnnounceMsg(e.target.value)}
                            placeholder="공지 내용..."
                            rows={3}
                            className="w-full bg-[#333] border border-[#555] rounded px-2 py-1.5 text-xs text-white mb-2 focus:border-orange-500 outline-none resize-none"
                        />
                        <button 
                            onClick={() => handleSendAnnouncement(null)}
                            className="w-full bg-orange-700 hover:bg-orange-600 text-white py-2 rounded text-xs font-bold border border-orange-500 shadow-lg flex items-center justify-center gap-2"
                        >
                            <Radio size={14} /> 전체 발송
                        </button>
                    </div>

                    <div className="bg-[#2a2a2a] p-3 rounded border border-[#444]">
                        <h4 className="text-xs font-bold text-indigo-400 uppercase mb-3 flex items-center gap-2">
                            <MapPin size={14} /> 공간 이동 관리 (Transport)
                        </h4>
                        <button 
                            onClick={() => { if(confirm("모든 플레이어를 현재 맵으로 소환하시겠습니까?")) onSummonPlayer?.('ALL') }}
                            className="w-full bg-indigo-700 hover:bg-indigo-600 text-white py-2 rounded text-xs font-bold border border-indigo-500 shadow-lg flex items-center justify-center gap-2 mb-4"
                        >
                            <Users size={14} /> 모든 플레이어 소환
                        </button>
                        
                        <div className="space-y-2">
                            <h5 className="text-[10px] text-gray-500 font-bold uppercase mb-2">플레이어 목록</h5>
                            {characters.map(char => (
                                <div key={char.id} className="flex items-center justify-between bg-[#1e1e1e] p-2 rounded border border-[#333]">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-6 h-6 rounded bg-gray-700 shrink-0 overflow-hidden">
                                            {char.avatar ? <img src={char.avatar} className="w-full h-full object-cover"/> : <User size={12} className="m-auto mt-1"/>}
                                        </div>
                                        <span className="text-xs text-gray-300 truncate">{char.name}</span>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button 
                                            onClick={() => handleSendAnnouncement(char.id)}
                                            className="bg-[#333] hover:bg-orange-600 text-gray-400 hover:text-white px-2 py-1 rounded text-[10px] border border-[#444] transition-colors"
                                            title="개인 공지"
                                        >
                                            공지
                                        </button>
                                        <button 
                                            onClick={() => onSummonPlayer?.(char.id)}
                                            className="bg-[#333] hover:bg-indigo-600 text-gray-400 hover:text-white px-2 py-1 rounded text-[10px] border border-[#444] transition-colors"
                                            title="소환"
                                        >
                                            소환
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#2a2a2a] p-3 rounded border border-[#444]">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase mb-3 flex items-center gap-2">
                            <Layers size={14} /> 오브젝트 관리
                        </h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                            {currentMapObjects.length === 0 && <p className="text-[10px] text-gray-600 italic">표시할 오브젝트 없음</p>}
                            {currentMapObjects.map(obj => (
                                <div key={obj.id} className="flex items-center justify-between bg-[#1e1e1e] p-2 rounded border border-[#333]">
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: obj.color }}></div>
                                        <span className={`text-[11px] truncate ${obj.hidden ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{obj.label}</span>
                                    </div>
                                    <button 
                                        onClick={() => onToggleVisibility?.(currentMapId, obj.id, !obj.hidden)}
                                        className={`px-2 py-1 rounded text-[10px] border transition-colors flex items-center gap-1 ${obj.hidden ? 'bg-red-900/30 text-red-400 border-red-800 hover:bg-red-900/50' : 'bg-emerald-900/30 text-emerald-400 border-emerald-800 hover:bg-emerald-900/50'}`}
                                        title={obj.hidden ? "활성화" : "숨기기"}
                                    >
                                        {obj.hidden ? <EyeOff size={12}/> : <Eye size={12}/>}
                                        <span className="font-bold">{obj.hidden ? 'OFF' : 'ON'}</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

        </div>
        </div>

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
