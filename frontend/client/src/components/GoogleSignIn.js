import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from './AuthContext';

function GoogleSignIn({ onSuccess, onError }) {
  const { googleLogin } = useAuth();

  const handleSuccess = async (credentialResponse) => {
    try {
      const userData = await googleLogin(credentialResponse.credential);
      
      if (onSuccess) {
        onSuccess(userData);
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || 'Google sign-in failed';
      if (onError) {
        onError(errorMessage);
      }
    }
  };

  const handleError = () => {
    const errorMessage = 'Google sign-in was cancelled or failed';
    if (onError) {
      onError(errorMessage);
    }
  };

  // Check if Google Client ID is configured
  if (!process.env.REACT_APP_GOOGLE_CLIENT_ID) {
    return (
      <div className="w-full p-3 text-sm text-gray-500 text-center bg-gray-50 rounded-lg border border-gray-200">
        Google Sign-In is not configured. Please set REACT_APP_GOOGLE_CLIENT_ID in your .env file.
      </div>
    );
  }

  return (
    <div className="w-full">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        useOneTap={false}
        theme="outline"
        size="large"
        text="signin_with"
        shape="rectangular"
        logo_alignment="left"
      />
    </div>
  );
}

export default GoogleSignIn;
