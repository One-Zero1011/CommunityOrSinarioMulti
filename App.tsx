
import React, { useState } from 'react';
import { Editor } from './components/editor/Editor';
import { Player } from './components/player/Player';
import { MobilePlayer } from './components/mobile/MobilePlayer';
import { MobileEditor } from './components/mobile/MobileEditor';
import { FactionEditor } from './components/faction/FactionEditor';
import { FactionPlayer } from './components/faction/FactionPlayer';
import { Home } from './components/Home';
import { INITIAL_GAME_DATA, INITIAL_FACTION_DATA } from './lib/constants';
import { GameData, FactionGameData } from './types';
import { loadGameDataFromFile, loadFactionDataFromFile } from './lib/file-storage';
import { useNetwork } from './hooks/useNetwork';
import { useIsMobile } from './hooks/useIsMobile';

type AppMode = 'HOME' | 'EDITOR' | 'PLAYER' | 'FACTION_EDITOR' | 'FACTION_PLAYER';

function App() {
  const [mode, setMode] = useState<AppMode>('HOME');
  const [gameData, setGameData] = useState<GameData>(INITIAL_GAME_DATA);
  const [factionData, setFactionData] = useState<FactionGameData>(INITIAL_FACTION_DATA);
  const [loadedFileMessage, setLoadedFileMessage] = useState<string | null>(null);
  
  // Custom Hook for Network Logic
  const network = useNetwork();
  
  // Mobile Detection
  const isMobile = useIsMobile();

  const handleDataLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await loadGameDataFromFile(file);
        setGameData(data);
        setLoadedFileMessage("파일을 불러왔습니다");
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : '파일 로드 중 오류가 발생했습니다.');
        setLoadedFileMessage(null);
      }
    }
  };

  const handleFactionDataLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              const data = await loadFactionDataFromFile(file);
              setFactionData(data);
              setMode('FACTION_PLAYER');
          } catch (err) {
              console.error(err);
              alert(err instanceof Error ? err.message : '진영 데이터 로드 중 오류가 발생했습니다.');
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

  const handleJoinFactionGame = (hostId: string) => {
    network.joinGame(hostId);
    setMode('FACTION_PLAYER');
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
          onStartFactionEditor={() => setMode('FACTION_EDITOR')}
          onLoadFactionFile={handleFactionDataLoad}
          onJoinFactionGame={handleJoinFactionGame}
          isConnecting={network.isConnecting}
          loadedFileMessage={loadedFileMessage}
        />
      )}
      {mode === 'EDITOR' && (
        isMobile ? (
          <MobileEditor 
            initialData={gameData} 
            onSave={(newData) => setGameData(newData)} 
            onBack={() => setMode('HOME')} 
          />
        ) : (
          <Editor 
            initialData={gameData} 
            onSave={(newData) => setGameData(newData)} 
            onBack={() => setMode('HOME')} 
          />
        )
      )}
      {mode === 'PLAYER' && (
        isMobile ? (
          <MobilePlayer 
            gameData={gameData} 
            onExit={() => {
                network.disconnect();
                setMode('HOME');
                setLoadedFileMessage(null);
            }}
            network={network}
          />
        ) : (
          <Player 
            gameData={gameData} 
            onExit={() => {
                network.disconnect();
                setMode('HOME');
                setLoadedFileMessage(null);
            }}
            network={network}
          />
        )
      )}
      {mode === 'FACTION_EDITOR' && (
          <FactionEditor 
             initialData={factionData}
             onBack={() => setMode('HOME')}
          />
      )}
      {mode === 'FACTION_PLAYER' && (
          <FactionPlayer 
              data={factionData}
              network={network}
              onExit={() => {
                  network.disconnect();
                  setMode('HOME');
              }}
          />
      )}
    </>
  );
}

export default App;