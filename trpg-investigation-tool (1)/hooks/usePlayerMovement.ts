
import React, { useEffect, useRef, useCallback } from 'react';
import { Character, NetworkMode, MapObject } from '../types';

interface UsePlayerMovementProps {
  characters: Character[];
  activeCharId: string;
  currentMapId: string;
  networkMode: NetworkMode;
  isModalOpen: boolean;
  objects: MapObject[]; // Added to check for collisions
  mapWidth?: number;  // New
  mapHeight?: number; // New
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  onSendMoveAction: (charId: string, x: number, y: number, mapId: string) => void;
}

const CHAR_SIZE = 64;
const MOVE_SPEED = 4;

export const usePlayerMovement = ({
  characters,
  activeCharId,
  currentMapId,
  networkMode,
  isModalOpen,
  objects,
  mapWidth = 1200, // Default fallback
  mapHeight = 800, // Default fallback
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
      objects,
      mapWidth,
      mapHeight,
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
          objects,
          mapWidth,
          mapHeight,
          onSendMoveAction
      };
  }, [characters, activeCharId, currentMapId, networkMode, isModalOpen, objects, mapWidth, mapHeight, onSendMoveAction]);

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

  // Helper for collision checking
  const checkCollision = (x: number, y: number, objs: MapObject[]) => {
      return objs.some(obj => {
          if (!obj.isSolid || obj.hidden) return false;
          return (
              x < obj.x + obj.width &&
              x + CHAR_SIZE > obj.x &&
              y < obj.y + obj.height &&
              y + CHAR_SIZE > obj.y
          );
      });
  };

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
                // Use dynamic map dimensions
                let nextX = Math.max(0, Math.min(state.mapWidth - CHAR_SIZE, char.x + dx));
                let nextY = Math.max(0, Math.min(state.mapHeight - CHAR_SIZE, char.y + dy));

                // Collision Detection with individual axis check for sliding
                // Check X axis
                if (checkCollision(nextX, char.y, state.objects)) {
                    nextX = char.x;
                }
                // Check Y axis
                if (checkCollision(nextX, nextY, state.objects)) {
                    nextY = char.y;
                }

                // Always update if position changed
                if (nextX !== char.x || nextY !== char.y) {
                    // Update Logic
                    const updatedChar = { ...char, x: nextX, y: nextY, mapId: state.currentMapId };
                    
                    // Create new characters array
                    const newCharacters = [...state.characters];
                    newCharacters[charIndex] = updatedChar;

                    // IMPORTANT: Update the ref immediately so the next frame sees the new position
                    state.characters = newCharacters;

                    // Update React State
                    setCharacters(newCharacters);
                    
                    // Throttled Network Sync (50ms for smoother movement)
                    const now = Date.now();
                    if (now - lastSyncTime.current > 50) {
                        // Call action regardless of mode, let parent handle Host broadcasting
                        state.onSendMoveAction(state.activeCharId, nextX, nextY, state.currentMapId);
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
