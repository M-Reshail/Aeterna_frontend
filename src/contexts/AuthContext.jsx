import React, { createContext, useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import authService from '@services/authService';
import { USER_KEY } from '@utils/constants';
import {
  getAccessToken,
  getStoredUser,
  clearTokens,
  decodeToken,
} from '@utils/tokenUtils';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state from local storage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = getAccessToken();
        const storedUser = getStoredUser();
        // Restore session if token is structurally valid (even if expired — it will be
        // refreshed on the first API call via the request interceptor in api.js)
        if (storedToken && storedUser && decodeToken(storedToken)) {
          setToken(storedToken);
          setUser(storedUser);
        } else {
          // Missing or corrupted session — clear everything
          clearTokens();
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setInitializing(false);
      }
    };
    initializeAuth();

    // Listen for forced logout from api.js (token refresh failed)
    const handleForcedLogout = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('auth:logout', handleForcedLogout);
    return () => window.removeEventListener('auth:logout', handleForcedLogout);
  }, []);

  const register = useCallback(async (email, password, confirmPassword) => {
    setLoading(true);
    setError(null);
    try {
      if (password !== confirmPassword) throw new Error('Passwords do not match');
      const response = await authService.register(email, password);
      return response;
    } catch (err) {
      const errorMsg = err.data?.detail || err.message;
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      // authService.login saves tokens; the real API does not return a user object
      const response = await authService.login(email, password);
      setToken(response.access_token);
      // Fetch profile to populate user state
      const profile = await authService.getProfile();
      setUser(profile);
      localStorage.setItem(USER_KEY, JSON.stringify(profile));
      return response;
    } catch (err) {
      console.error('❌ AuthContext.login - Error:', err);
      const errorMsg = err.data?.detail || err.message;
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    setError(null);
    try {
      await authService.logout(); // clears localStorage + removes refreshToken from db
    } catch {
      clearTokens(); // fallback if server is unreachable
    }
  }, []);

  const updateProfile = useCallback(async (updates) => {
    setLoading(true);
    setError(null);
    try {
      // api.js returns data directly (not wrapped in { data: ... })
      const updatedUser = await authService.updateProfile(updates);
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      return updatedUser;
    } catch (err) {
      const errorMsg = err.data?.detail || err.message;
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const changePassword = useCallback(async (_currentPassword, _newPassword, _confirmPassword) => {
    // The real API does not expose a direct change-password endpoint for authenticated users.
    // Use the password-reset flow (request → email → confirm) instead.
    throw new Error('Password change is not supported directly. Use the Forgot Password flow.');
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.requestPasswordReset(email);
      return response;
    } catch (err) {
      const errorMsg = err.data?.detail || err.message;
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (token, password, confirmPassword) => {
    setLoading(true);
    setError(null);
    try {
      if (password !== confirmPassword) throw new Error('Passwords do not match');
      const response = await authService.confirmPasswordReset(token, password);
      return response;
    } catch (err) {
      const errorMsg = err.data?.detail || err.message;
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const isAuthenticated = !!token && !!user;

  const value = {
    user,
    token,
    loading,
    initializing,
    error,
    isAuthenticated,
    register,
    login,
    logout,
    updateProfile,
    changePassword,
    requestPasswordReset,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
