import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from './components/AuthContext';
import Header from './components/Header';
import StrategyMultiSelect from './components/StrategyMultiSelect';
import CredentialsModal from './components/CredentialsModal';
import { Edit, Trash2, Key, Brain, Target } from 'lucide-react';

const Account = () => {
  const { user, token } = useAuth();
  const [tables, setTables] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ name: '', email: '', api_key: '', api_secret: '', use_ml: false, strategies: [] });
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);

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
          strategies: Array.isArray(me.data.data?.strategies) ? me.data.data?.strategies : []
        });
      } catch (e) {
        console.error(e);
      }
    })();
  }, [token, authHeaders]);

  const loadLedger = async (strategyName) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedStrategy(strategyName);
      const strategyId = strategyName.split('_').slice(-2).join('_'); // strategy_01
      const res = await axios.get(`/api/me/execution/ledger?strategy=${strategyId}`, { headers: authHeaders });
      setLedger(res.data.data?.ledger || res.data.data || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load ledger');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await axios.put('/api/auth/me', {
        api_key: profile.api_key,
        api_secret: profile.api_secret,
        strategies: profile.strategies,
        use_ml: profile.use_ml
      }, { headers: authHeaders });
      setProfile(prev => ({ ...prev, api_secret: '' }));
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleSaveCredentials = async (credentialsData) => {
    // Prepare the data to send
    const updateData = {
      name: credentialsData.name,
      email: credentialsData.email,
      password: credentialsData.password,
      api_key: credentialsData.api_key,
      strategies: credentialsData.strategies,
      use_ml: credentialsData.use_ml
    };
    
    // Only include api_secret if it's provided (not empty)
    if (credentialsData.api_secret && credentialsData.api_secret.trim() !== '') {
      updateData.api_secret = credentialsData.api_secret;
    }
    
    const response = await axios.put('/api/auth/me', updateData, { headers: authHeaders });
    
    // Update local profile state with the response data
    const updatedData = response.data.data;
    setProfile({
      name: updatedData.name || '',
      email: updatedData.email || '',
      api_key: updatedData.api_key || '',
      api_secret: '', // Clear secret for security
      strategies: Array.isArray(updatedData.strategies) ? updatedData.strategies : [],
      use_ml: !!updatedData.use_ml
    });
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
          use_ml: false
        });
      } catch (e) {
        setError(e?.response?.data?.error || 'Failed to delete credentials');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header activePage="account" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-lg">
                {(user?.name || user?.email || 'U').toString().slice(0,1).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Account Settings</h1>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Exchange Credentials Summary */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Key className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Account Settings & Trading Preferences</h2>
                <div className="flex items-center space-x-4 mt-1">
                  <div className="flex items-center space-x-1">
                    <span className="text-sm text-gray-500">Name:</span>
                    <span className="text-sm font-medium text-gray-700">
                      {profile.name || 'Not set'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-sm text-gray-500">API Key:</span>
                    <span className={`text-sm font-medium ${profile.api_key ? 'text-green-600' : 'text-gray-500'}`}>
                      {profile.api_key ? 'Configured' : 'Not configured'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Brain className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">ML:</span>
                    <span className={`text-sm font-medium ${profile.use_ml ? 'text-green-600' : 'text-gray-500'}`}>
                      {profile.use_ml ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Target className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-500">Strategies:</span>
                    <span className="text-sm font-medium text-gray-700">
                      {profile.strategies?.length || 0} selected
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowCredentialsModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Edit size={16} />
                <span>Edit</span>
              </button>
              {profile.api_key && (
                <button
                  onClick={handleDeleteCredentials}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Execution Ledgers - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Execution Ledgers</h2>
            {tables.length === 0 && (
              <div className="text-center py-8">
                <div className="text-sm text-gray-500">No execution tables found.</div>
                <div className="text-xs text-gray-400 mt-1">Configure strategies above to start trading</div>
              </div>
            )}
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {tables.map((t) => (
                <li key={t}>
                  <button
                    onClick={() => loadLedger(t)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all duration-200 ${
                      selectedStrategy === t 
                        ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                        : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{t}</div>
                    <div className="text-xs text-gray-500 mt-1">Click to view ledger</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Execution Ledger</h2>
                {selectedStrategy && <div className="text-xs text-gray-500 mt-0.5">{selectedStrategy}</div>}
              </div>
              {loading && <div className="text-xs text-gray-500">Loading...</div>}
            </div>
            {error && <div className="px-6 py-3 text-sm text-red-600">{error}</div>}
            {(!loading && ledger.length === 0) ? (
              <div className="px-6 py-16 text-center">
                <div className="text-sm text-gray-500">Select a ledger to view execution data</div>
                <div className="text-xs text-gray-400 mt-1">Choose from the available ledgers on the left</div>
              </div>
            ) : (
              <div className="overflow-auto max-h-96">
                <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Datetime</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Action</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Buy</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Sell</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">PnL %</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">PnL Sum</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ledger.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-800">{new Date(row.datetime).toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm capitalize">{row.action}</td>
                      <td className="px-4 py-2 text-sm">{Number(row.buy_price).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm">{Number(row.sell_price).toFixed(2)}</td>
                      <td className={`px-4 py-2 text-sm font-medium ${Number(row.pnl_percent) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{Number(row.pnl_percent).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm">{Number(row.pnl_sum).toFixed(2)}</td>
                      <td className="px-4 py-2 text-sm">{Number(row.balance).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
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


