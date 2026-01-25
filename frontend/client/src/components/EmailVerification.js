import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Mail, Clock, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from './AuthContext';

function EmailVerification({ email, onVerified, onCancel }) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(60); // 60 seconds cooldown for resend
  const [canResend, setCanResend] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const inputRefs = useRef([]);
  const { setUser, setToken } = useAuth();

  // Check if user is already verified when component loads
  useEffect(() => {
    const checkVerificationStatus = async () => {
      try {
        // Check if user is already verified by trying to verify with any code
        // Backend will return success with token if already verified
        const res = await axios.post('/api/auth/verify-email', {
          email,
          code: '000000', // Dummy code - backend will check if already verified first
        });
        
        // If successful and has token, user is already verified
        if (res.data.success && res.data.data && res.data.data.token) {
          const { user: userData, token: jwt } = res.data.data;
          setUser(userData);
          setToken(jwt);
          localStorage.setItem('auth_token', jwt);
          
          // Close modal immediately
          if (onVerified) {
            onVerified(userData);
          }
          return;
        }
      } catch (err) {
        // If error is "Invalid verification code", user is not verified yet - continue
        // If error is something else, also continue
      }
      // User is not verified yet, show verification UI
      setCheckingStatus(false);
    };

    if (email) {
      checkVerificationStatus();
    } else {
      setCheckingStatus(false);
    }
  }, [email, setUser, setToken, onVerified]);

  useEffect(() => {
    // Start countdown timer
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleCodeChange = (index, value) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        const digits = text.replace(/\D/g, '').slice(0, 6).split('');
        const newCode = [...code];
        digits.forEach((digit, i) => {
          if (i < 6) newCode[i] = digit;
        });
        setCode(newCode);
        if (digits.length === 6) {
          inputRefs.current[5]?.focus();
        }
      });
    }
  };

  const handleVerify = async () => {
    const verificationCode = code.join('');
    
    // Allow empty code - backend will check if already verified
    // If code is provided but incomplete, show error
    if (verificationCode.length > 0 && verificationCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Send request - backend will check if already verified first
      const res = await axios.post('/api/auth/verify-email', {
        email,
        code: verificationCode || '000000', // Backend checks verification status before validating code
      });

      // Handle success response
      if (res.data && res.data.success) {
        const responseData = res.data.data;
        
        // Check if we have user and token data
        if (responseData && (responseData.user || responseData.token)) {
          const userData = responseData.user || responseData;
          const jwt = responseData.token;
          
          // Update auth context
          if (userData && jwt) {
            setUser(userData);
            setToken(jwt);
            localStorage.setItem('auth_token', jwt);
            
            // Close modal immediately
            if (onVerified) {
              onVerified(userData);
            }
            return; // Success - exit
          }
        }
      }
      
      // If we get here, response structure is unexpected
      console.warn('Unexpected response structure:', res.data);
      setError('Unexpected response. Please try again.');
    } catch (err) {
      console.error('Verification error:', err);
      
      // Check if it's actually a success response (200 status)
      if (err.response && err.response.status === 200 && err.response.data && err.response.data.success) {
        const responseData = err.response.data.data;
        if (responseData && responseData.user && responseData.token) {
          setUser(responseData.user);
          setToken(responseData.token);
          localStorage.setItem('auth_token', responseData.token);
          if (onVerified) onVerified(responseData.user);
          return;
        }
      }
      
      // Handle actual errors
      const errorMsg = err?.response?.data?.error || err?.message || 'Invalid verification code. Please try again.';
      setError(errorMsg);
      
      // Clear code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setResendLoading(true);
    setError(null);

    try {
      await axios.post('/api/auth/resend-verification', { email });
      setCode(['', '', '', '', '', '']);
      setCountdown(60);
      setCanResend(false);
      inputRefs.current[0]?.focus();
      // Show success message
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to resend verification code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-300 border-t-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Checking verification status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Verify Your Email</h3>
        <p className="text-sm text-gray-600 mb-1">
          We've sent a 6-digit verification code to
        </p>
        <p className="text-sm font-semibold text-gray-900">{email}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
          <XCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-3 text-center">
          Enter Verification Code
        </label>
        <div className="flex justify-center space-x-2 mb-4">
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength="1"
              value={digit}
              onChange={(e) => handleCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleVerify}
          disabled={loading || (code.join('').length > 0 && code.join('').length !== 6)}
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow hover:shadow-md transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Verifying...' : code.join('').length === 6 ? 'Verify Email' : 'Check Verification Status'}
        </button>
        
        {code.join('').length === 0 && (
          <p className="text-xs text-gray-500 text-center">
            Click "Check Verification Status" to see if you're already verified, or enter your 6-digit code above.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          onClick={handleResend}
          disabled={!canResend || resendLoading}
          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Sending...</span>
            </>
          ) : canResend ? (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>Resend Code</span>
            </>
          ) : (
            <>
              <Clock className="w-4 h-4" />
              <span>Resend in {countdown}s</span>
            </>
          )}
        </button>

        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancel
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 text-center">
        Didn't receive the code? Check your spam folder or click "Resend Code" after the timer expires.
      </p>
    </div>
  );
}

export default EmailVerification;
