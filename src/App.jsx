"use client";

import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './views/Dashboard';
import BatchDetails from './views/BatchDetails';
import Login from './views/Login';
import { AlertCircle, CheckCircle, Info, ShieldAlert, X, Loader2 } from 'lucide-react';

export default function App() {
  const [scannerMode, setScannerMode] = useState('mobile'); // 'mobile' | 'desktop'
  const [currentPage, setCurrentPage] = useState('dashboard'); // 'dashboard' | 'batch-details'
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // Toast notifications
  const [toast, setToast] = useState(null);

  const showToast = ({ type, text }) => {
    setToast({ type, text, id: Date.now() });
  };

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setIsAuthenticated(true);
            setUser(data.user);
          }
        }
      } catch (err) {
        console.error('Failed to verify session:', err);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [toast]);

  const handleNavigate = (page, batchId = null) => {
    setSelectedBatchId(batchId);
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#f3f6f9] flex flex-col items-center justify-center font-sans antialiased">
        <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-[2rem] border border-gray-200/50 shadow-xl">
          <div className="h-12 w-12 rounded-full bg-orange-50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#f15a38]" />
          </div>
          <span className="text-xs font-extrabold text-gray-500 uppercase tracking-widest">SIRA SYSTEM LOADING</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen w-full bg-[#96a7bc] flex items-center justify-center p-0 sm:p-4 md:p-8 font-sans antialiased">
      {/* Premium Desktop App Window Mockup */}
      <div className="w-full max-w-[1280px] min-h-[92vh] bg-[#f3f6f9] rounded-none sm:rounded-[2rem] md:rounded-[2.5rem] shadow-2xl border border-white/40 flex flex-col overflow-hidden relative">
        {/* App Navbar */}
        <Navbar 
          scannerMode={scannerMode} 
          setScannerMode={setScannerMode} 
          currentPage={currentPage}
          onNavigate={handleNavigate}
          user={user}
          onLogout={handleLogout}
        />
        
        {/* Main Content Area */}
        <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 overflow-y-auto">
          {currentPage === 'dashboard' ? (
            <Dashboard 
              scannerMode={scannerMode} 
              onNavigate={handleNavigate} 
              onShowToast={showToast} 
            />
          ) : (
            <BatchDetails 
              batchId={selectedBatchId} 
              scannerMode={scannerMode} 
              onNavigate={handleNavigate} 
              onShowToast={showToast} 
            />
          )}
        </main>
      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-12 inset-x-0 z-50 flex justify-center px-4 animate-bounce-short">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-md border text-sm max-w-md transition-all duration-300 ${
            toast.type === 'success' 
              ? 'bg-green-50/95 text-green-800 border-green-200/50' 
              : toast.type === 'error'
                ? 'bg-red-50/90 text-red-800 border-red-200/50'
                : toast.type === 'warning'
                  ? 'bg-amber-50/90 text-amber-800 border-red-200/50'
                  : 'bg-blue-50/90 text-blue-800 border-blue-200/50'
          }`}>
            <span className="shrink-0">
              {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
              {toast.type === 'warning' && <ShieldAlert className="w-5 h-5 text-amber-600" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600" />}
            </span>
            <p className="font-semibold leading-snug">{toast.text}</p>
            <button 
              onClick={() => setToast(null)} 
              className="p-0.5 rounded-full hover:bg-black/5 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
