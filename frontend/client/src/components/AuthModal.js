import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { useAuth } from './AuthContext';
import GoogleSignIn from './GoogleSignIn';
import EmailVerification from './EmailVerification';

const AuthModal = () => {
  const { login, signup, showAuth, authMode, closeAuth } = useAuth();
  const [activeTab, setActiveTab] = useState(authMode || 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [useMl, setUseMl] = useState(false);
  const [allStrategies, setAllStrategies] = useState([]);
  const [strategySearch, setStrategySearch] = useState('');
  const [selectedStrategies, setSelectedStrategies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showVerification, setShowVerification] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [resetStep, setResetStep] = useState('request'); // 'request' | 'confirm'
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');

  useEffect(() => { if (showAuth) setActiveTab(authMode); }, [authMode, showAuth]);

  useEffect(() => {
    if (!showAuth || activeTab !== 'signup') return;
    (async () => {
      try {
        const res = await axios.get('/api/strategies');
        const list = (res.data?.data || []).map(s => ({ label: s.name, value: s.name }));
        setAllStrategies(list);
      } catch {}
    })();
  }, [showAuth, activeTab]);

  const filteredStrategies = useMemo(() => {
    const q = strategySearch.toLowerCase();
    return allStrategies.filter(s => s.label.toLowerCase().includes(q));
  }, [allStrategies, strategySearch]);

  const toggleStrategy = (value) => {
    setSelectedStrategies(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setLoading(true); setError(null);
      await login(email, password);
      closeAuth();
    } catch (err) {
      const errorMsg = err?.response?.data?.error || 'Login failed';
      setError(errorMsg);
      
      // If login failed due to unverified email, show verification UI
      if (err?.response?.data?.requiresVerification) {
        setSignupEmail(err?.response?.data?.email || email);
        setShowVerification(true);
        setActiveTab('signup'); // Switch to signup tab to show verification
      }
    } finally { setLoading(false); }
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    try {
      setLoading(true); setError(null);
      await axios.post('/api/auth/request-password-reset', { email: resetEmail });
      setResetStep('confirm');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to request password reset');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    try {
      setLoading(true); setError(null);
      await axios.post('/api/auth/reset-password', { email: resetEmail, code: resetCode, new_password: resetNewPassword });
      // Back to login
      setShowReset(false);
      setResetStep('request');
      setResetEmail('');
      setResetCode('');
      setResetNewPassword('');
      setError('Password reset successful. Please sign in.');
      setActiveTab('login');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      setLoading(true); setError(null);
      // Signup now only collects basic fields
      const response = await signup({ name, email, password });
      
      // If signup successful, show verification UI instead of closing
      if (response || true) { // signup might not return user if verification required
        setSignupEmail(email);
        setShowVerification(true);
        setError(null); // Clear any errors
      }
    } catch (err) {
      setError(err?.response?.data?.error || 'Signup failed');
    } finally { setLoading(false); }
  };

  const handleVerificationComplete = (userData) => {
    // User is now verified and logged in
    // Reset form first
    setName('');
    setEmail('');
    setPassword('');
    setShowVerification(false);
    setSignupEmail('');
    // Close modal - user is now logged in
    closeAuth();
  };

  const handleCancelVerification = () => {
    setShowVerification(false);
    setSignupEmail('');
  };

  if (!showAuth) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900/80 via-blue-900/70 to-slate-900/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
        <div className="px-8 pt-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {activeTab === 'login' ? 'Welcome back' : 'Create your account'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {activeTab === 'login' ? 'Sign in to continue to Aegis Trading' : 'Join Aegis Trading to manage strategies and execution'}
              </p>
            </div>
            <button onClick={closeAuth} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="mt-6 inline-flex p-1 rounded-xl bg-gray-100 border border-gray-200">
            <button onClick={() => setActiveTab('login')} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab==='login' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-800'}`}>Sign in</button>
            <button onClick={() => setActiveTab('signup')} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab==='signup' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-800'}`}>Sign up</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 mt-6">
          <div className="p-8">
            {error && !showVerification && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

            {showVerification ? (
              <EmailVerification 
                email={signupEmail}
                onVerified={handleVerificationComplete}
                onCancel={handleCancelVerification}
              />
            ) : showReset ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-gray-900">Reset password</h4>
                  <button
                    type="button"
                    onClick={() => { setShowReset(false); setResetStep('request'); setError(null); }}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Back to sign in
                  </button>
                </div>

                {resetStep === 'request' ? (
                  <form onSubmit={handleRequestReset} className="space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm"
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                    <button type="submit" disabled={loading} className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl font-semibold shadow hover:shadow-md transition-shadow disabled:opacity-50">
                      {loading ? 'Sending code...' : 'Send reset code'}
                    </button>
                    <p className="text-xs text-gray-500 text-center">We’ll email you a 6‑digit code (valid for 10 minutes).</p>
                  </form>
                ) : (
                  <form onSubmit={handleConfirmReset} className="space-y-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm"
                        placeholder="you@example.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-2">Reset code</label>
                      <input
                        type="text"
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm"
                        placeholder="6-digit code"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-2">New password</label>
                      <input
                        type="password"
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm"
                        placeholder="New password"
                        required
                      />
                    </div>
                    <button type="submit" disabled={loading} className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow hover:shadow-md transition-shadow disabled:opacity-50">
                      {loading ? 'Resetting...' : 'Reset password'}
                    </button>
                  </form>
                )}
              </div>
            ) : activeTab === 'login' ? (
              <div className="space-y-5">
                <GoogleSignIn 
                  onSuccess={() => closeAuth()} 
                  onError={(err) => setError(err)}
                />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or continue with email</span>
                  </div>
                </div>
                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Email</label>
                    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm" placeholder="you@example.com" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">Password</label>
                    <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm" placeholder="••••••••" required />
                  </div>
                  <button type="submit" disabled={loading} className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow hover:shadow-md transition-shadow disabled:opacity-50">{loading?'Signing in...':'Sign in'}</button>
                  <button
                    type="button"
                    onClick={() => { setShowReset(true); setResetStep('request'); setResetEmail(email || ''); setError(null); }}
                    className="w-full text-sm font-semibold text-blue-700 hover:text-blue-900"
                  >
                    Forgot password?
                  </button>
                  <p className="text-xs text-gray-500 text-center">By continuing, you agree to our Terms and Privacy Policy.</p>
                </form>
              </div>
            ) : (
              <div className="space-y-5">
                <GoogleSignIn 
                  onSuccess={() => closeAuth()} 
                  onError={(err) => setError(err)}
                />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or sign up with email</span>
                  </div>
                </div>
                <form onSubmit={handleSignup} className="space-y-5">
                  <div className="grid grid-cols-1 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-2">Name</label>
                      <input type="text" value={name} onChange={e=>setName(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm" placeholder="Your name" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-2">Email</label>
                      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm" placeholder="you@example.com" required />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-2">Password</label>
                      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow shadow-sm" placeholder="Create a strong password" required />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow hover:shadow-md transition-shadow disabled:opacity-50">{loading?'Creating...':'Create account'}</button>
                  <p className="text-xs text-gray-500 text-center">You can add API keys and strategies later in your Account.</p>
                </form>
              </div>
            )}
          </div>
          <div className="hidden md:block p-8 bg-gradient-to-br from-blue-50 to-indigo-50 border-l border-gray-200">
            <div className="h-full rounded-2xl bg-white/70 border border-white/60 shadow-inner p-6 flex flex-col justify-center items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow mb-4">
                <span className="text-xl font-extrabold">A</span>
              </div>
              <h4 className="text-lg font-bold text-gray-900">Aegis Trading</h4>
              <p className="text-sm text-gray-600 mt-2 max-w-sm">AI-powered signal and execution platform. Connect once, and we handle the rest.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;


