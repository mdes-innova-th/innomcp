<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-28 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":64,"completion_tokens":945,"total_tokens":1009,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":692,"image_tokens":0},"cache_creation_input_tokens":0} | 11s
 generated: 2026-06-13T05:26:32.606Z -->
import { createContext, useContext, useState, ReactNode } from 'react';

export interface User {
  id: number;
  name: string;
  role: string;
}

interface UserContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = (userData: User) => {
    // TODO: Replace with real authentication (API call, token storage, etc.)
    setUser(userData);
  };

  const logout = () => {
    // TODO: Clear any stored tokens or session data
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
