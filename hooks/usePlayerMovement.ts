
import React, { useEffect, useRef, useCallback } from 'react';
import { Character, NetworkMode } from '../types';

interface UsePlayerMovementProps {
  characters: Character[];
  activeCharId: string;
  currentMapId: string;
  networkMode: NetworkMode;
  isModalOpen: boolean;
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  onSendMoveAction: (charId: string, x: number, y: number, mapId: string) => void;
}

const MAP_WIDTH = 1200;
const MAP_HEIGHT = 800;
const CHAR_SIZE = 64;
const MOVE_SPEED = 4;

export const usePlayerMovement = ({
  characters,
  activeCharId,
  currentMapId,
  networkMode,
  isModalOpen,
  setCharacters,
  onSendMoveAction
}: UsePlayerMovementProps) => {
  const keysPressed = useRef<Set<string>>(new Set());
  const requestRef = useRef<number>(0);
  const lastSyncTime = useRef<number>(0);
  
  // Store latest props/state in a ref
  const latestState = useRef({
      characters,
      activeCharId,
      currentMapId,
      networkMode,
      isModalOpen,
      onSendMoveAction
  });

  // Sync ref with current props
  useEffect(() => {
      latestState.current = {
          characters,
          activeCharId,
          currentMapId,
          networkMode,
          isModalOpen,
          onSendMoveAction
      };
  }, [characters, activeCharId, currentMapId, networkMode, isModalOpen, onSendMoveAction]);

  // Key Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                keysPressed.current.add(e.key.toLowerCase());
            }
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) {
            keysPressed.current.delete(e.key.toLowerCase());
        }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Game Loop
  const animate = useCallback(() => {
    const state = latestState.current;

    if (state.isModalOpen) {
        requestRef.current = requestAnimationFrame(animate);
        return;
    }

    if (keysPressed.current.size > 0) {
        const charIndex = state.characters.findIndex(c => c.id === state.activeCharId);
        
        if (charIndex !== -1) {
            const char = state.characters[charIndex];
            let dx = 0;
            let dy = 0;

            if (keysPressed.current.has('w')) dy -= MOVE_SPEED;
            if (keysPressed.current.has('s')) dy += MOVE_SPEED;
            if (keysPressed.current.has('a')) dx -= MOVE_SPEED;
            if (keysPressed.current.has('d')) dx += MOVE_SPEED;

            // Normalize diagonal
            if (dx !== 0 && dy !== 0) {
                const factor = 0.7071;
                dx *= factor;
                dy *= factor;
            }

            if (dx !== 0 || dy !== 0) {
                const newX = Math.max(0, Math.min(MAP_WIDTH - CHAR_SIZE, char.x + dx));
                const newY = Math.max(0, Math.min(MAP_HEIGHT - CHAR_SIZE, char.y + dy));

                // Always update if position changed, removed the > 0.1 threshold check to prevent 'sticking' near walls
                if (newX !== char.x || newY !== char.y) {
                    // Update Logic
                    const updatedChar = { ...char, x: newX, y: newY, mapId: state.currentMapId };
                    
                    // Create new characters array
                    const newCharacters = [...state.characters];
                    newCharacters[charIndex] = updatedChar;

                    // IMPORTANT: Update the ref immediately so the next frame sees the new position
                    // even if React hasn't finished re-rendering yet.
                    state.characters = newCharacters;

                    // Update React State
                    setCharacters(newCharacters);
                    
                    // Throttled Network Sync (50ms)
                    const now = Date.now();
                    if (now - lastSyncTime.current > 50) {
                        if (state.networkMode === 'CLIENT') {
                            state.onSendMoveAction(state.activeCharId, newX, newY, state.currentMapId);
                        }
                        lastSyncTime.current = now;
                    }
                }
            }
        }
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [setCharacters]);

  // Start/Stop Loop
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);
};
