
import React, { useState } from 'react';
import { Editor } from './components/editor/Editor';
import { Player } from './components/player/Player';
import { Home } from './components/Home';
import { INITIAL_GAME_DATA } from './lib/constants';
import { GameData } from './types';
import { loadGameDataFromFile } from './lib/file-storage';
import { useNetwork } from './hooks/useNetwork';

type AppMode = 'HOME' | 'EDITOR' | 'PLAYER';

function App() {
  const [mode, setMode] = useState<AppMode>('HOME');
  const [gameData, setGameData] = useState<GameData>(INITIAL_GAME_DATA);
  const [loadedFileMessage, setLoadedFileMessage] = useState<string | null>(null);
  
  // Custom Hook for Network Logic
  const network = useNetwork();

  const handleDataLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await loadGameDataFromFile(file);
        setGameData(data);
        setLoadedFileMessage("파일을 불러왔습니다");
        // alert 제거 및 상태 메시지로 대체
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : '파일 로드 중 오류가 발생했습니다.');
        setLoadedFileMessage(null);
      }
    }
  };

  const handleStartHost = () => {
    network.startHost();
    setMode('PLAYER');
  };

  const handleJoinGame = (hostId: string) => {
    network.joinGame(hostId);
    setMode('PLAYER');
  };

  return (
    <>
      {mode === 'HOME' && (
        <Home 
          onStartEditor={() => { network.setNetworkMode('SOLO'); setMode('EDITOR'); }}
          onStartPlayer={() => { network.setNetworkMode('SOLO'); setMode('PLAYER'); }}
          onStartHost={handleStartHost}
          onJoinGame={handleJoinGame}
          onLoadFile={handleDataLoad}
          isConnecting={network.isConnecting}
          loadedFileMessage={loadedFileMessage}
        />
      )}
      {mode === 'EDITOR' && (
        <Editor 
          initialData={gameData} 
          onSave={(newData) => setGameData(newData)} 
          onBack={() => setMode('HOME')} 
        />
      )}
      {mode === 'PLAYER' && (
        <Player 
          gameData={gameData} 
          onExit={() => {
              network.disconnect();
              setMode('HOME');
              setLoadedFileMessage(null);
          }}
          network={network}
        />
      )}
    </>
  );
}

export default App;
