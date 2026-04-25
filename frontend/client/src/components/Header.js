import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { BarChart3, User, LogOut, Settings, ChevronDown } from 'lucide-react';

const Header = ({ activePage = 'simulator' }) => {
  const { isAuthenticated, user, logout, openAuth } = useAuth() || {};
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 shadow-lg border-b border-blue-800/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-6">
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-6 hover:opacity-80 transition-opacity">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg flex items-center justify-center">
                  <BarChart3 className="w-7 h-7 text-white" />
                </div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-3xl font-bold text-white tracking-tight">Aegis Trading</h1>
                <p className="text-blue-200 text-sm font-medium">AI-Powered Signal & Execution System</p>
              </div>
            </Link>
          </div>
          
          {/* Enhanced Navigation */}
          <nav className="flex items-center space-x-3">
            <Link
              to="/"
              className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${
                activePage === 'home'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transform border border-blue-500/20'
                  : 'text-blue-200 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-blue-500/20'
              }`}
            >
              <span>Home</span>
            </Link>
            <Link
              to="/simulator"
              className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${
                activePage === 'simulator'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transform border border-blue-500/20'
                  : 'text-blue-200 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-blue-500/20'
              }`}
            >
              <span>Strategies</span>
            </Link>
            <Link
              to="/models"
              className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${
                activePage === 'models'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transform border border-blue-500/20'
                  : 'text-blue-200 hover:text-white hover:bg-white/10 backdrop-blur-sm border border-blue-500/20'
              }`}
            >
              <span>Models</span>
            </Link>
            <div className="relative" ref={dropdownRef}>
              {!isAuthenticated ? (
                <button
                  onClick={() => openAuth('login')}
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-blue-200 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  aria-label="Account"
                  title="Account"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4 text-white">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25a8.25 8.25 0 0115 0" />
                    </svg>
                  </div>
                </button>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">
                        {(user?.name || user?.email || 'U').toString().slice(0,1).toUpperCase()}
                      </span>
                    </div>
                    <span className="hidden sm:block">{user?.name || 'User'}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
                        <p className="text-xs text-gray-500">{user?.email}</p>
                      </div>
                      <div className="py-1">
                        <Link
                          to="/account"
                          onClick={() => setMenuOpen(false)}
                          className={`flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors ${
                            activePage === 'account' ? 'bg-blue-50 text-blue-700' : ''
                          }`}
                        >
                          <Settings className="w-4 h-4" />
                          <span>Account Settings</span>
                        </Link>
                        <button
                          onClick={() => { logout(); setMenuOpen(false); }}
                          className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header; 