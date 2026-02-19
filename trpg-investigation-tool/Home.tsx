
import React, { useState } from 'react';
import { Edit3, PlayCircle, Upload, Dice5, Users, Wifi, CheckCircle2, Grid, Sword, Crosshair, PenTool } from 'lucide-react';
import { Button } from './common/Button';

interface HomeProps {
  onStartEditor: () => void;
  onStartPlayer: () => void;
  onStartHost: () => void;
  onJoinGame: (hostId: string) => void;
  onLoadFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  
  onStartFactionEditor: () => void;
  onLoadFactionFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onJoinFactionGame: (hostId: string) => void;

  onStartCombatEditor: () => void;
  onLoadCombatFile: (e: React.ChangeEvent<HTMLInputElement>) => void;

  isConnecting: boolean;
  loadedFileMessage?: string | null;
}

export const Home: React.FC<HomeProps> = ({ 
  onStartEditor, onStartPlayer, onStartHost, onJoinGame, onLoadFile, 
  onStartFactionEditor, onLoadFactionFile, onJoinFactionGame,
  onStartCombatEditor, onLoadCombatFile,
  isConnecting, loadedFileMessage 
}) => {
  const [activeTab, setActiveTab] = useState<'SINGLE' | 'MULTI' | 'COMBAT' | 'FACTION'>('SINGLE');
  const [joinId, setJoinId] = useState('');
  const [factionJoinId, setFactionJoinId] = useState('');

  return (
    <div className="min-h-screen bg-[#2e2e2e] text-gray-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full text-center space-y-12">
        <div className="space-y-4 animate-fade-in-up">
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-600 p-4 rounded-full shadow-lg shadow-indigo-500/30">
              <Dice5 size={64} className="text-white" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
            TRPG 조사 툴
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            직관적인 맵 에디터, 확률 기반 오브젝트 상호작용, P2P 멀티플레이.
          </p>
        </div>

        <div className="flex justify-center gap-4 mb-8 flex-wrap">
            <button 
                onClick={() => setActiveTab('SINGLE')}
                className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === 'SINGLE' ? 'bg-white text-black' : 'bg-[#383838] text-gray-400 hover:bg-[#444]'}`}
            >
                싱글플레이 / 제작
            </button>
            <button 
                onClick={() => setActiveTab('MULTI')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${activeTab === 'MULTI' ? 'bg-indigo-500 text-white' : 'bg-[#383838] text-gray-400 hover:bg-[#444]'}`}
            >
                <Wifi size={16} /> 멀티플레이 (Beta)
            </button>
            <button 
                onClick={() => setActiveTab('COMBAT')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${activeTab === 'COMBAT' ? 'bg-rose-600 text-white' : 'bg-[#383838] text-gray-400 hover:bg-[#444]'}`}
            >
                <Crosshair size={16} /> 전투 모드
            </button>
            <button 
                onClick={() => setActiveTab('FACTION')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${activeTab === 'FACTION' ? 'bg-orange-600 text-white' : 'bg-[#383838] text-gray-400 hover:bg-[#444]'}`}
            >
                <Sword size={16} /> 진영 멀티플레이
            </button>
        </div>

        {activeTab === 'SINGLE' && (
            <div className="grid md:grid-cols-2 gap-8 w-full max-w-3xl mx-auto animate-fade-in">
            <div className="bg-[#383838] p-8 rounded-2xl border border-[#444] hover:border-indigo-500 transition-all hover:shadow-2xl hover:shadow-indigo-900/20 group">
                <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2 group-hover:text-indigo-400">
                <Edit3 /> 시나리오 제작
                </h2>
                <p className="text-gray-400 mb-8 h-12">맵 구성, 단서 배치, 확률 테이블 설정.</p>
                <Button fullWidth onClick={onStartEditor} variant="secondary">에디터 실행</Button>
            </div>

            <div className="bg-[#383838] p-8 rounded-2xl border border-[#444] hover:border-emerald-500 transition-all hover:shadow-2xl hover:shadow-emerald-900/20 group flex flex-col">
                <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2 group-hover:text-emerald-400">
                <PlayCircle /> 조사 시작
                </h2>
                <p className="text-gray-400 mb-6 h-10 text-sm">파일을 불러와 호스트가 되거나 코드로 참가합니다.</p>
                
                <div className="flex flex-col gap-4 mt-auto">
                    {/* Host Section */}
                    <div className="space-y-2">
                        <label className="w-full bg-[#2e2e2e] hover:bg-[#252525] border border-[#555] cursor-pointer text-white font-bold py-3 px-6 rounded-lg transition-colors text-center flex items-center justify-center gap-2 hover:border-emerald-500/50">
                            <Upload size={18} className="text-emerald-400"/> 파일 불러오기
                            <input type="file" accept=".json,.zip" onChange={onLoadFile} className="hidden" />
                        </label>
                        
                        {loadedFileMessage && (
                          <div className="flex items-center justify-center gap-1 text-green-400 text-sm font-bold animate-pulse">
                            <CheckCircle2 size={16} />
                            <span>{loadedFileMessage}</span>
                          </div>
                        )}

                        <button onClick={onStartPlayer} className="w-full text-xs text-gray-500 hover:text-emerald-400 underline decoration-dotted">
                            (파일 없이 바로 시작)
                        </button>
                    </div>

                    <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-[#555]"></div>
                        <span className="flex-shrink-0 mx-2 text-gray-500 text-xs">OR</span>
                        <div className="flex-grow border-t border-[#555]"></div>
                    </div>

                    {/* Join Section */}
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="참가 코드"
                            value={joinId}
                            onChange={(e) => setJoinId(e.target.value)}
                            className="flex-1 bg-[#2e2e2e] border border-[#555] rounded px-3 py-2 text-center font-mono focus:border-blue-500 outline-none uppercase text-sm text-white placeholder-gray-600"
                        />
                        <Button variant="join" onClick={() => onJoinGame(joinId)} disabled={!joinId || isConnecting} className="px-4 text-sm whitespace-nowrap">
                            참가
                        </Button>
                    </div>
                </div>
            </div>
            </div>
        )}

        {activeTab === 'MULTI' && (
            <div className="grid md:grid-cols-2 gap-8 w-full max-w-2xl mx-auto animate-fade-in">
                <div className="bg-[#383838] p-8 rounded-2xl border border-[#444] hover:border-orange-500 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={120} /></div>
                    <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2 text-orange-400">방 만들기 (Host)</h2>
                    <p className="text-gray-400 mb-6 h-12 text-sm">현재 로드된 시나리오로 방을 만듭니다.</p>
                    <Button fullWidth variant="host" onClick={onStartHost} disabled={isConnecting}>
                        {isConnecting ? '방 생성 중...' : '방 생성 및 시작'}
                    </Button>
                </div>

                <div className="bg-[#383838] p-8 rounded-2xl border border-[#444] hover:border-blue-500 transition-all group">
                    <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2 text-blue-400">참가하기 (Guest)</h2>
                    <p className="text-gray-400 mb-6 h-12 text-sm">초대 코드를 입력하여 입장합니다.</p>
                    <div className="space-y-3">
                        <input 
                            type="text" 
                            placeholder="초대 코드 입력"
                            value={joinId}
                            onChange={(e) => setJoinId(e.target.value)}
                            className="w-full bg-[#2e2e2e] border border-[#555] rounded px-4 py-3 text-center text-lg font-mono focus:border-blue-500 outline-none uppercase"
                        />
                        <Button fullWidth variant="join" onClick={() => onJoinGame(joinId)} disabled={!joinId || isConnecting}>
                            {isConnecting ? '연결 중...' : '입장하기'}
                        </Button>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'COMBAT' && (
             <div className="grid md:grid-cols-2 gap-8 w-full max-w-3xl mx-auto animate-fade-in">
                <div className="bg-[#383838] p-8 rounded-2xl border border-[#444] hover:border-rose-500 transition-all group">
                    <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2 group-hover:text-rose-400">
                        <PenTool /> 전투 시스템 제작
                    </h2>
                    <p className="text-gray-400 mb-8 h-12">스탯의 종류와 최소/최대치를 설정하여<br/>나만의 TRPG 룰을 만듭니다.</p>
                    <Button fullWidth onClick={onStartCombatEditor} variant="secondary">전투 제작 (Editor)</Button>
                </div>

                <div className="bg-[#383838] p-8 rounded-2xl border border-[#444] hover:border-rose-500 transition-all group flex flex-col">
                    <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2 group-hover:text-rose-400">
                        <PlayCircle /> 전투 플레이
                    </h2>
                    <p className="text-gray-400 mb-6 h-10 text-sm">제작된 전투 설정 파일을 불러와 캐릭터를 만들고 주사위를 굴립니다.</p>
                    
                    <div className="mt-auto">
                        <label className="w-full bg-[#2e2e2e] hover:bg-[#252525] border border-[#555] cursor-pointer text-white font-bold py-3 px-6 rounded-lg transition-colors text-center flex items-center justify-center gap-2 hover:border-rose-500/50">
                            <Upload size={18} className="text-rose-400" /> 전투 파일 불러오기
                            <input type="file" accept=".json" onChange={onLoadCombatFile} className="hidden" />
                        </label>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'FACTION' && (
            <div className="grid md:grid-cols-2 gap-8 w-full max-w-3xl mx-auto animate-fade-in">
                 <div className="bg-[#383838] p-8 rounded-2xl border border-[#444] hover:border-yellow-500 transition-all group">
                    <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2 group-hover:text-yellow-400">
                    <Grid /> 진영 맵 제작
                    </h2>
                    <p className="text-gray-400 mb-8 h-12">네모난 블록들을 이용해 진영 점령전 맵을 제작합니다.<br/>(시나리오 모드와 별개입니다)</p>
                    <Button fullWidth onClick={onStartFactionEditor} variant="secondary">진영 에디터 실행</Button>
                </div>

                <div className="bg-[#383838] p-8 rounded-2xl border border-[#444] hover:border-orange-500 transition-all group relative overflow-hidden flex flex-col">
                     <div className="absolute top-0 right-0 p-4 opacity-10"><Sword size={120} /></div>
                    <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2 text-orange-400">
                    <Sword /> 진영 게임
                    </h2>
                    <p className="text-gray-400 mb-6 h-10 text-sm">제작된 파일을 불러오거나, 코드를 입력해 참가합니다.</p>
                    
                    <div className="flex flex-col gap-4 mt-auto">
                        <label className="w-full bg-[#2e2e2e] hover:bg-[#252525] border border-[#555] cursor-pointer text-white font-bold py-3 px-6 rounded-lg transition-colors text-center flex items-center justify-center gap-2 hover:border-orange-500/50">
                            <Upload size={18} className="text-orange-400" /> 파일 불러오기 (Host)
                            <input type="file" accept=".json" onChange={onLoadFactionFile} className="hidden" />
                        </label>

                        <div className="relative flex py-1 items-center">
                            <div className="flex-grow border-t border-[#555]"></div>
                            <span className="flex-shrink-0 mx-2 text-gray-500 text-xs">OR</span>
                            <div className="flex-grow border-t border-[#555]"></div>
                        </div>

                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="참가 코드"
                                value={factionJoinId}
                                onChange={(e) => setFactionJoinId(e.target.value)}
                                className="flex-1 bg-[#2e2e2e] border border-[#555] rounded px-3 py-2 text-center font-mono focus:border-orange-500 outline-none uppercase text-sm text-white placeholder-gray-600"
                            />
                            <Button variant="join" onClick={() => onJoinFactionGame(factionJoinId)} disabled={!factionJoinId || isConnecting} className="px-4 text-sm whitespace-nowrap bg-orange-700 hover:bg-orange-600">
                                참가
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};