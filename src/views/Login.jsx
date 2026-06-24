"use client";

import React, { useState } from 'react';
import { User, Lock, AlertCircle, Loader2 } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (data.success) {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#1e293b] via-[#0f172a] to-[#334155] p-4 relative overflow-hidden font-sans">
      {/* Background ambient glowing blobs */}
      <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-[#f15a38]/10 rounded-full blur-[120px] animate-pulse delay-700"></div>

      {/* Main glass card */}
      <div className="w-full max-w-[440px] bg-white/5 border border-white/10 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-8 sm:p-10 relative z-10 flex flex-col items-center">
        {/* Brand/Logo */}
        <div className="h-16 w-16 rounded-full bg-gradient-to-tr from-[#f15a38] to-[#ff7e5f] flex items-center justify-center shadow-lg shadow-orange-500/25 mb-4 hover:scale-105 transition-transform duration-300">
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">SIRA</h1>
        <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase mb-8">Asset & Inventory Audit</p>

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-semibold animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <p className="leading-snug">{error}</p>
            </div>
          )}

          {/* Username Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-300 ml-1">Username</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Enter admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-white placeholder-gray-500 focus:outline-none focus:border-[#f15a38] focus:ring-1 focus:ring-[#f15a38] transition-all disabled:opacity-50"
              />
              <User className="absolute left-4 top-3.5 w-4.5 h-4.5 text-gray-500" />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-300 ml-1">Password</label>
            <div className="relative">
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-white placeholder-gray-500 focus:outline-none focus:border-[#f15a38] focus:ring-1 focus:ring-[#f15a38] transition-all disabled:opacity-50"
              />
              <Lock className="absolute left-4 top-3.5 w-4.5 h-4.5 text-gray-500" />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-[#f15a38] to-[#ff7e5f] hover:from-[#e04f2d] hover:to-[#ee6d4e] active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-orange-500/20 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase">
            Secured Audit Control Session
          </p>
        </div>
      </div>
    </div>
  );
}
