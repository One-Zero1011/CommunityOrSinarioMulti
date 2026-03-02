
import { FactionPlayerProfile, FactionGameData, NetworkMode } from '../types';

const SESSION_KEY = 'trpg_faction_session';

export interface FactionSession {
    myProfile: FactionPlayerProfile | null;
    isAdmin: boolean;
    networkMode: NetworkMode;
    hostId: string | null;
    factionData: FactionGameData | null;
    timestamp: number;
}

export const saveFactionSession = (session: Partial<FactionSession>) => {
    const existing = getFactionSession();
    const updated = {
        ...existing,
        ...session,
        timestamp: Date.now()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
};

export const getFactionSession = (): FactionSession | null => {
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    try {
        const session = JSON.parse(data);
        // Session valid for 24 hours
        if (Date.now() - session.timestamp > 24 * 60 * 60 * 1000) {
            clearFactionSession();
            return null;
        }
        return session;
    } catch (e) {
        return null;
    }
};

export const clearFactionSession = () => {
    localStorage.removeItem(SESSION_KEY);
};
