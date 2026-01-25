import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(!!localStorage.getItem('auth_token'));
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  useEffect(() => {
    const source = axios.CancelToken.source();
    (async () => {
      try {
        const jwt = token || localStorage.getItem('auth_token');
        if (!jwt) { 
          setUser(null); 
          setLoading(false);
          return; 
        }
        
        // Only set loading to true if we have a token to validate
        setLoading(true);
        const res = await axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${jwt}` }, cancelToken: source.token });
        setUser(res.data.data || res.data);
      } catch (e) {
        console.error('Failed to load profile', e);
        setUser(null);
        // Clear invalid token
        if (e.response?.status === 401) {
          setToken(null);
          localStorage.removeItem('auth_token');
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => source.cancel('cancelled');
  }, [token]);

  const login = async (email, password) => {
    const res = await axios.post('/api/auth/login', { email, password });
    const { user: userData, token: jwt } = res.data.data || res.data;
    setUser(userData);
    setToken(jwt);
    localStorage.setItem('auth_token', jwt);
    return userData;
  };

  const signup = async (payload) => {
    const res = await axios.post('/api/auth/signup', payload);
    // Signup now returns message instead of token (email verification required)
    // Return the response so AuthModal can handle verification UI
    return res.data;
  };

  const googleLogin = async (googleToken) => {
    const res = await axios.post('/api/auth/google', { token: googleToken });
    const { user: userData, token: jwt } = res.data.data || res.data;
    setUser(userData);
    setToken(jwt);
    localStorage.setItem('auth_token', jwt);
    setShowAuth(false);
    return userData;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
  };

  const openAuth = (mode = 'login') => { setAuthMode(mode); setShowAuth(true); };
  const closeAuth = () => setShowAuth(false);

  const value = useMemo(() => ({ 
    user, 
    token, 
    loading, 
    login, 
    signup, 
    googleLogin, 
    logout, 
    isAuthenticated: !!user, 
    showAuth, 
    authMode, 
    openAuth, 
    closeAuth,
    setUser,
    setToken
  }), [user, token, loading, showAuth, authMode]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}


