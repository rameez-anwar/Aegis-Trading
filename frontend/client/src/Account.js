import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from './components/AuthContext';
import Header from './components/Header';
import CredentialsModal from './components/CredentialsModal';
import { Edit, Trash2, Key, Brain, Target, TrendingUp, TrendingDown, X, AlertCircle, Activity, DollarSign, BarChart3, Settings, Zap, Shield } from 'lucide-react';

const Account = () => {
  const { user, token } = useAuth();
  const [tables, setTables] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [selectedTableName, setSelectedTableName] = useState('');
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ name: '', email: '', api_key: '', api_secret: '', use_ml: false, strategies: [], avatar: null });
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  
  // Live Trading State
  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [closingPosition, setClosingPosition] = useState(null);
  
  // Leverage State
  const [leverage, setLeverage] = useState({});
  const [leverageLoading, setLeverageLoading] = useState(false);
  const [leverageInput, setLeverageInput] = useState({});
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'live-trading', 'leverage', 'ledger'

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await axios.get('/api/me/execution/tables', { headers: authHeaders });
        setTables(res.data.data || []);
        const me = await axios.get('/api/auth/me', { headers: authHeaders });
        setProfile({
          name: me.data.data?.name || '',
          email: me.data.data?.email || '',
          api_key: me.data.data?.api_key || '',
          api_secret: '',
          use_ml: !!me.data.data?.use_ml,
          strategies: Array.isArray(me.data.data?.strategies) ? me.data.data?.strategies : [],
          avatar: me.data.data?.avatar || null
        });
        
        // Load positions and leverage
        loadPositions();
        loadLeverage();
      } catch (e) {
        console.error(e);
      }
    })();
  }, [token, authHeaders]);

  const loadPositions = async () => {
    try {
      setPositionsLoading(true);
      const res = await axios.get('/api/me/positions', { headers: authHeaders });
      setPositions(res.data.data || []);
    } catch (e) {
      console.error('Failed to load positions:', e);
      setPositions([]);
    } finally {
      setPositionsLoading(false);
    }
  };

  const loadLeverage = async () => {
    try {
      setLeverageLoading(true);
      const res = await axios.get('/api/me/leverage', { headers: authHeaders });
      setLeverage(res.data.data || {});
    } catch (e) {
      console.error('Failed to load leverage:', e);
    } finally {
      setLeverageLoading(false);
    }
  };

  const closePosition = async (symbol, side, qty) => {
    if (!window.confirm(`Are you sure you want to close this position? ${side} ${qty} ${symbol}`)) {
      return;
    }
    
    try {
      setClosingPosition(symbol);
      await axios.post(`/api/me/positions/${symbol}/close`, 
        { side, qty },
        { headers: authHeaders }
      );
      await loadPositions(); // Refresh positions
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to close position');
    } finally {
      setClosingPosition(null);
    }
  };

  const updateLeverage = async (symbol, newLeverage) => {
    try {
      setLeverageLoading(true);
      await axios.post('/api/me/leverage', 
        { symbol, leverage: newLeverage },
        { headers: authHeaders }
      );
      await loadLeverage(); // Refresh leverage
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to update leverage');
    } finally {
      setLeverageLoading(false);
    }
  };

  const loadLedger = async (table) => {
    try {
      setLoading(true);
      setError(null);
      // Handle both old format (string) and new format (object)
      const tableName = typeof table === 'string' ? table : table.tableName;
      const displayName = typeof table === 'string' ? table : table.displayName;
      const strategyName = typeof table === 'string' 
        ? table.split('_').slice(-2).join('_') 
        : table.strategyName;
      
      setSelectedStrategy(displayName);
      setSelectedTableName(tableName);
      
      // Extract strategy ID from table name (e.g., "execution.user_67_strategy_01" -> "strategy_01")
      const strategyId = strategyName;
      const res = await axios.get(`/api/me/execution/ledger?strategy=${strategyId}`, { headers: authHeaders });
      setLedger(res.data.data?.ledger || res.data.data || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCredentials = async (credentialsData) => {
    const updateData = {
      name: credentialsData.name,
      email: credentialsData.email,
      password: credentialsData.password,
      api_key: credentialsData.api_key,
      strategies: credentialsData.strategies,
      use_ml: credentialsData.use_ml
    };
    
    if (credentialsData.api_secret && credentialsData.api_secret.trim() !== '') {
      updateData.api_secret = credentialsData.api_secret;
    }
    
    const response = await axios.put('/api/auth/me', updateData, { headers: authHeaders });
    
    const updatedData = response.data.data;
    setProfile({
      name: updatedData.name || '',
      email: updatedData.email || '',
      api_key: updatedData.api_key || '',
      api_secret: '',
      strategies: Array.isArray(updatedData.strategies) ? updatedData.strategies : [],
      use_ml: !!updatedData.use_ml,
      avatar: updatedData.avatar || profile.avatar || null
    });
    
    // Reload positions and leverage after credentials update
    loadPositions();
    loadLeverage();
  };

  const handleDeleteCredentials = async () => {
    if (window.confirm('Are you sure you want to delete your API credentials? This will stop all trading activities.')) {
      try {
        await axios.put('/api/auth/me', {
          api_key: '',
          api_secret: '',
          strategies: [],
          use_ml: false
        }, { headers: authHeaders });
        
          setProfile({
            name: '',
            email: '',
            api_key: '',
            api_secret: '',
            strategies: [],
            use_ml: false,
            avatar: null
          });
        setPositions([]);
        setLeverage({});
      } catch (e) {
        setError(e?.response?.data?.error || 'Failed to delete credentials');
      }
    }
  };

  // Calculate portfolio stats
  const portfolioStats = useMemo(() => {
    const totalPnL = positions.reduce((sum, pos) => sum + (pos.unrealized_pnl || 0), 0);
    const totalValue = positions.reduce((sum, pos) => sum + (pos.position_value || 0), 0);
    const openPositions = positions.length;
    const winningPositions = positions.filter(pos => (pos.unrealized_pnl || 0) > 0).length;
    
    return {
      totalPnL,
      totalValue,
      openPositions,
      winningPositions,
      winRate: openPositions > 0 ? (winningPositions / openPositions * 100).toFixed(1) : 0
    };
  }, [positions]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header activePage="account" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Professional Header */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center space-x-4 flex-1">
                {/* Avatar */}
                <div className="relative">
                  {(profile.avatar || user?.avatar) ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200">
                      <img 
                        src={profile.avatar || user?.avatar} 
                        alt={profile.name || user?.name || 'User'} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center hidden">
                        <span className="text-xl font-semibold text-gray-600">
                          {(profile.name || user?.name || profile.email || user?.email || 'U').toString().slice(0,1).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-200 border-2 border-gray-300 flex items-center justify-center">
                      <span className="text-xl font-semibold text-gray-600">
                        {(profile.name || user?.name || profile.email || user?.email || 'U').toString().slice(0,1).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900 mb-1">
                    {profile.name || 'Account Dashboard'}
                  </h1>
                  <p className="text-gray-600 text-sm mb-3">{profile.email}</p>
                  
                  {/* Status badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium ${
                      profile.api_key ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      <Key className="w-3.5 h-3.5" />
                      <span>{profile.api_key ? 'API Connected' : 'API Not Connected'}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      <Target className="w-3.5 h-3.5" />
                      <span>{profile.strategies?.length || 0} Strategies</span>
                    </div>
                    <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-medium border ${
                      profile.use_ml 
                        ? 'bg-purple-50 text-purple-700 border-purple-200' 
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                      <Brain className="w-3.5 h-3.5" />
                      <span>{profile.use_ml ? 'ML Enabled' : 'ML Disabled'}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => setShowCredentialsModal(true)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700 font-medium">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4 text-red-500" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <nav className="flex border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'live-trading', label: 'Live Trading', icon: Activity },
              { id: 'leverage', label: 'Leverage', icon: Zap },
              { id: 'ledger', label: 'Execution Ledger', icon: DollarSign }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-gray-900 text-gray-900'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Portfolio Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    portfolioStats.totalPnL >= 0 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {portfolioStats.totalPnL >= 0 ? '+' : ''}{portfolioStats.totalPnL.toFixed(2)}%
                  </span>
                </div>
                <h3 className="text-gray-500 text-xs font-medium mb-1">Total P&L</h3>
                <p className="text-2xl font-semibold text-gray-900">${portfolioStats.totalValue.toFixed(2)}</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Activity className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-700">
                    {portfolioStats.openPositions}
                  </span>
                </div>
                <h3 className="text-gray-500 text-xs font-medium mb-1">Open Positions</h3>
                <p className="text-2xl font-semibold text-gray-900">
                  {portfolioStats.winningPositions} <span className="text-sm text-gray-500 font-normal">Winning</span>
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-purple-100 text-purple-700">
                    {portfolioStats.winRate}%
                  </span>
                </div>
                <h3 className="text-gray-500 text-xs font-medium mb-1">Win Rate</h3>
                <p className="text-2xl font-semibold text-gray-900">
                  {portfolioStats.openPositions} <span className="text-sm text-gray-500 font-normal">Total</span>
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Shield className="w-5 h-5 text-indigo-600" />
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    profile.api_key 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {profile.api_key ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <h3 className="text-gray-500 text-xs font-medium mb-1">Trading Status</h3>
                <p className="text-2xl font-semibold text-gray-900">
                  {profile.strategies?.length || 0} <span className="text-sm text-gray-500 font-normal">Strategies</span>
                </p>
              </div>
            </div>

            {/* Account Settings Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Account Settings</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Manage your trading configuration</p>
                  </div>
                  <button
                    onClick={() => setShowCredentialsModal(true)}
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
                  >
                    <Edit size={16} />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Key className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <span className="text-gray-900 font-medium block">API Key</span>
                          <span className="text-xs text-gray-500">Trading credentials</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-xs font-medium ${
                        profile.api_key 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {profile.api_key ? 'Configured' : 'Not Set'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Brain className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <span className="text-gray-900 font-medium block">ML Models</span>
                          <span className="text-xs text-gray-500">Machine learning</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded text-xs font-medium ${
                        profile.use_ml 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {profile.use_ml ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Target className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <span className="text-gray-900 font-medium block">Active Strategies</span>
                          <span className="text-xs text-gray-500">Trading strategies</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        {profile.strategies?.length || 0}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Activity className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <span className="text-gray-900 font-medium block">Account Status</span>
                          <span className="text-xs text-gray-500">System status</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Trading Tab */}
        {activeTab === 'live-trading' && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Live Trading Positions</h2>
                  <p className="text-sm text-gray-600 mt-1">Monitor and manage your open positions</p>
                </div>
                <button
                  onClick={loadPositions}
                  disabled={positionsLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  <Activity className="w-4 h-4" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {positionsLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading positions...</p>
              </div>
            ) : positions.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Open Positions</h3>
                <p className="text-gray-500">You don't have any open positions at the moment.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Symbol</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Side</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Size</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Entry Price</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Mark Price</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Leverage</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Unrealized P&L</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">Position Value</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {positions.map((position, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-semibold text-gray-900">{position.symbol}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            position.side === 'Buy' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {position.side}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">{position.size}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">${position.entry_price?.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">${position.mark_price?.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                            {position.leverage}x
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`font-bold ${
                            position.unrealized_pnl >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {position.unrealized_pnl >= 0 ? '+' : ''}${position.unrealized_pnl?.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900">${position.position_value?.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => closePosition(position.symbol, position.side, position.size)}
                            disabled={closingPosition === position.symbol}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
                          >
                            {closingPosition === position.symbol ? 'Closing...' : 'Close Position'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Leverage Tab */}
        {activeTab === 'leverage' && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Leverage Management</h2>
              <p className="text-gray-600">Set leverage for your trading pairs</p>
            </div>

            {!profile.api_key ? (
              <div className="text-center py-12 bg-yellow-50 rounded-lg border border-yellow-200">
                <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">API Credentials Required</h3>
                <p className="text-gray-600 mb-4">Please configure your API credentials to manage leverage settings.</p>
                <button
                  onClick={() => setShowCredentialsModal(true)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Configure API
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Leverage Input Form */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Set Leverage</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Symbol</label>
                      <input
                        type="text"
                        placeholder="e.g., BTCUSDT"
                        value={leverageInput.symbol || ''}
                        onChange={(e) => setLeverageInput({ ...leverageInput, symbol: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Leverage (1-125x)</label>
                      <input
                        type="number"
                        min="1"
                        max="125"
                        placeholder="e.g., 10"
                        value={leverageInput.leverage || ''}
                        onChange={(e) => setLeverageInput({ ...leverageInput, leverage: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => {
                          if (leverageInput.symbol && leverageInput.leverage) {
                            updateLeverage(leverageInput.symbol, leverageInput.leverage);
                            setLeverageInput({});
                          }
                        }}
                        disabled={leverageLoading || !leverageInput.symbol || !leverageInput.leverage}
                        className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                      >
                        {leverageLoading ? 'Updating...' : 'Set Leverage'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Current Leverage Settings */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Leverage Settings</h3>
                  {Object.keys(leverage).length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">No leverage settings configured</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(leverage).map(([symbol, lev]) => (
                        <div key={symbol} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-900">{symbol}</span>
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
                              {lev}x
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Execution Ledger Tab */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            {/* Strategy Selector */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Execution Ledger</h2>
              {tables.length === 0 ? (
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <div className="text-sm text-gray-500">No execution tables found.</div>
                  <div className="text-xs text-gray-400 mt-1">Configure strategies to start trading</div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {tables.map((t) => {
                    const tableName = typeof t === 'string' ? t : t.tableName;
                    const displayName = typeof t === 'string' ? t : t.displayName;
                    const isSelected = selectedTableName === tableName || selectedStrategy === displayName;
                    
                    return (
                      <button
                        key={tableName}
                        onClick={() => loadLedger(t)}
                        className={`px-4 py-2 rounded-lg border transition-all duration-200 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                            : 'bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400 text-gray-700'
                        }`}
                      >
                        <span className="font-medium text-sm">{displayName}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Ledger Table */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Execution Ledger</h2>
                    {selectedStrategy && <div className="text-xs text-gray-500 mt-0.5">{selectedStrategy}</div>}
                  </div>
                  {loading && <div className="text-xs text-gray-500">Loading...</div>}
                </div>
              </div>
              {error && <div className="px-6 py-3 text-sm text-red-600">{error}</div>}
              {(!loading && ledger.length === 0) ? (
                <div className="px-6 py-16 text-center">
                  <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <div className="text-sm text-gray-500">Select a ledger to view execution data</div>
                  <div className="text-xs text-gray-400 mt-1">Choose from the available ledgers on the left</div>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Datetime</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Direction</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Action</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Buy Price</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Sell Price</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">PnL %</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">PnL Sum</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Balance</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Trade Amount</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider whitespace-nowrap">Order ID</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {ledger.map((row, idx) => (
                        <tr key={idx} className="hover:bg-blue-50 transition-colors">
                          <td className="px-3 py-3 text-sm text-gray-800 whitespace-nowrap">
                            {row.datetime ? new Date(row.datetime).toLocaleString() : '-'}
                          </td>
                          <td className="px-3 py-3 text-sm whitespace-nowrap">
                            {row.predicted_direction ? (
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                row.predicted_direction === 'long' ? 'bg-green-100 text-green-700' :
                                row.predicted_direction === 'short' ? 'bg-red-100 text-red-700' :
                                row.predicted_direction === 'neutral' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {row.predicted_direction}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              row.action === 'buy' || row.action?.includes('buy') || row.action === 'open' ? 'bg-green-100 text-green-700' :
                              row.action?.includes('sell') || row.action?.includes('close') || row.action?.includes('tp') || row.action?.includes('sl') ? 'bg-red-100 text-red-700' :
                              row.action === 'same direction' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {row.action || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {row.buy_price ? `$${Number(row.buy_price).toFixed(2)}` : '-'}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {row.sell_price ? `$${Number(row.sell_price).toFixed(2)}` : '-'}
                          </td>
                          <td className={`px-3 py-3 text-sm font-semibold whitespace-nowrap ${
                            Number(row.pnl_percent || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {row.pnl_percent !== null && row.pnl_percent !== undefined 
                              ? `${Number(row.pnl_percent) >= 0 ? '+' : ''}${Number(row.pnl_percent).toFixed(2)}%`
                              : '-'
                            }
                          </td>
                          <td className={`px-3 py-3 text-sm font-semibold whitespace-nowrap ${
                            Number(row.pnl_sum || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {row.pnl_sum !== null && row.pnl_sum !== undefined 
                              ? `${Number(row.pnl_sum) >= 0 ? '+' : ''}${Number(row.pnl_sum).toFixed(2)}`
                              : '-'
                            }
                          </td>
                          <td className="px-3 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">
                            {row.balance ? `$${Number(row.balance).toFixed(2)}` : '-'}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-900 whitespace-nowrap">
                            {row.trade_amount ? `$${Number(row.trade_amount).toFixed(2)}` : '-'}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600 font-mono text-xs whitespace-nowrap">
                            {row.order_id ? (
                              <span className="px-2 py-1 bg-gray-100 rounded text-xs" title={row.order_id}>
                                {row.order_id.length > 12 ? `${row.order_id.substring(0, 12)}...` : row.order_id}
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Credentials Modal */}
      <CredentialsModal
        isOpen={showCredentialsModal}
        onClose={() => setShowCredentialsModal(false)}
        onSave={handleSaveCredentials}
        initialData={profile}
      />
    </div>
  );
};

export default Account;
