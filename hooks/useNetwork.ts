
import { useState, useRef, useEffect, useCallback } from 'react';
// @ts-ignore
import { Peer } from 'peerjs';
import { generateId } from '../lib/utils';
import { NetworkMode, NetworkAction } from '../types';

interface UseNetworkReturn {
  networkMode: NetworkMode;
  setNetworkMode: (mode: NetworkMode) => void;
  peerId: string | null;
  isConnecting: boolean;
  hostConnection: any;
  connections: any[];
  startHost: () => void;
  joinGame: (hostId: string) => void;
  disconnect: () => void;
  broadcast: (data: NetworkAction) => void;
  sendToHost: (data: NetworkAction) => void;
}

export const useNetwork = (): UseNetworkReturn => {
  const [networkMode, setNetworkMode] = useState<NetworkMode>('SOLO');
  const [peerId, setPeerId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hostConnection, setHostConnection] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]); // State로 변경하여 리렌더링 유발
  
  const peerRef = useRef<any>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
    }
    setNetworkMode('SOLO');
    setPeerId(null);
    setHostConnection(null);
    setConnections([]);
  }, []);

  const startHost = useCallback(() => {
    setIsConnecting(true);
    const newPeer = new Peer(generateId(), { debug: 1 });
    
    newPeer.on('open', (id: string) => {
        console.log('[Network] Host started with ID:', id);
        setPeerId(id);
        setNetworkMode('HOST');
        setIsConnecting(false);
    });

    newPeer.on('connection', (conn: any) => {
        console.log('[Network] Client connected:', conn.peer);
        
        conn.on('open', () => {
             conn.send({ type: 'WELCOME', msg: 'Connected to Host' });
             setConnections(prev => [...prev, conn]); // 연결 성공 시 상태 업데이트
        });

        conn.on('close', () => {
            setConnections(prev => prev.filter(c => c !== conn));
        });
        
        conn.on('error', (err: any) => {
            console.error('Connection error:', err);
            setConnections(prev => prev.filter(c => c !== conn));
        });
    });

    newPeer.on('error', (err: any) => {
        console.error('[Network] Host Error:', err);
        setIsConnecting(false);
        alert('연결 오류: ' + err.type);
    });

    peerRef.current = newPeer;
  }, []);

  const joinGame = useCallback((hostId: string) => {
    setIsConnecting(true);
    const newPeer = new Peer({ debug: 1 });

    newPeer.on('open', () => {
        const conn = newPeer.connect(hostId, { reliable: true });
        
        conn.on('open', () => {
            console.log("[Network] Connected to Host:", hostId);
            setHostConnection(conn);
            setNetworkMode('CLIENT');
            setIsConnecting(false);
        });

        conn.on('error', (err: any) => {
            alert('접속 실패: ' + err);
            setIsConnecting(false);
        });
        
        conn.on('close', () => {
            alert('호스트와의 연결이 끊어졌습니다.');
            disconnect();
        });
    });

    newPeer.on('error', (err: any) => {
        console.error('[Network] Client Error:', err);
        setIsConnecting(false);
        alert('연결 오류: ' + err.type);
    });

    peerRef.current = newPeer;
  }, [disconnect]);

  const broadcast = useCallback((data: NetworkAction) => {
    // State인 connections를 사용
    connections.forEach(conn => {
        if (conn.open) {
            conn.send(data);
        }
    });
  }, [connections]);

  const sendToHost = useCallback((data: NetworkAction) => {
    if (hostConnection && hostConnection.open) {
        hostConnection.send(data);
    }
  }, [hostConnection]);

  return {
    networkMode,
    setNetworkMode,
    peerId,
    isConnecting,
    hostConnection,
    connections, 
    startHost,
    joinGame,
    disconnect,
    broadcast,
    sendToHost
  };
};
