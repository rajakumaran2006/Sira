"use client";

import React from 'react';
import { Camera, Keyboard, Search, Settings, Bell, LogOut } from 'lucide-react';

export default function Navbar({ scannerMode, setScannerMode, currentPage, onNavigate, user, onLogout }) {
  return (
    <header className="w-full bg-[#f3f6f9] border-b border-gray-200/40 px-6 sm:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 z-40">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate('dashboard')}>
        <div className="h-10 w-10 rounded-full bg-[#f15a38] flex items-center justify-center shadow-md shadow-orange-500/20 hover:scale-105 transition-transform duration-200">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
        </div>
        <div>
          <span className="font-extrabold text-xl tracking-tight text-[#1e293b] block leading-none">SIRA</span>
          <span className="text-[9px] text-gray-400 font-semibold tracking-wider uppercase">Audit System</span>
        </div>
      </div>

      {/* Centered Navigation Tabs */}
      <nav className="flex items-center justify-center gap-6 sm:gap-8 border-b md:border-b-0 border-gray-200/50 pb-2 md:pb-0">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`relative py-1.5 font-bold text-sm transition-all ${
            currentPage === 'dashboard'
              ? 'text-[#1e293b]'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <span>Home</span>
          {currentPage === 'dashboard' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1a56db] rounded-full"></span>
          )}
        </button>

        <button
          onClick={() => onNavigate('dashboard')} // Batches section is on dashboard
          className={`relative py-1.5 font-bold text-sm transition-all ${
            currentPage === 'batch-details'
              ? 'text-[#1e293b]'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <span>Batches</span>
          {currentPage === 'batch-details' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1a56db] rounded-full"></span>
          )}
        </button>

        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="relative py-1.5 font-bold text-sm text-gray-400 hover:text-gray-600 transition-all"
        >
          <span>Discover</span>
        </a>

        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="relative py-1.5 font-bold text-sm text-gray-400 hover:text-gray-600 transition-all"
        >
          <span>Settings</span>
        </a>
      </nav>

      {/* Search Bar & Action Buttons */}
      <div className="flex items-center justify-end gap-3 sm:gap-4 flex-wrap md:flex-nowrap">
        {/* Sleek Search Input */}
        <div className="relative w-full max-w-[200px] sm:max-w-[240px]">
          <input
            type="text"
            placeholder="Enter your search request..."
            className="w-full pl-4 pr-10 py-2.5 rounded-full border border-gray-200 bg-white/80 focus:bg-white text-xs font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-black transition-all"
          />
          <Search className="absolute right-3.5 top-3 w-4.5 h-4.5 text-gray-400 cursor-pointer" />
        </div>

        {/* Scanner Mode Toggle Pill */}
        <div className="bg-gray-200/50 p-0.5 rounded-full flex items-center border border-gray-200/40">
          <button
            onClick={() => setScannerMode('mobile')}
            className={`p-1.5 rounded-full transition-all duration-200 ${
              scannerMode === 'mobile'
                ? 'bg-white text-[#1e293b] shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Switch to Mobile Camera"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScannerMode('desktop')}
            className={`p-1.5 rounded-full transition-all duration-200 ${
              scannerMode === 'desktop'
                ? 'bg-white text-[#1e293b] shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title="Switch to Desktop HID Keyboard"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>

        {/* Action Circles */}
        <button className="h-9 w-9 rounded-full bg-white border border-gray-200/50 hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all">
          <Settings className="w-4.5 h-4.5" />
        </button>

        <button className="h-9 w-9 rounded-full bg-white border border-gray-200/50 hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all relative">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-[#f15a38] rounded-full border border-white"></span>
        </button>

        {/* User profile info & Logout */}
        <div className="flex items-center gap-2.5 pl-2.5 border-l border-gray-200/50">
          <div className="hidden sm:block text-right">
            <span className="text-xs font-bold text-gray-800 block leading-tight">{user?.username || 'Admin'}</span>
            <span className="text-[9px] font-semibold text-green-600 block">Active Session</span>
          </div>
          <div className="h-9 w-9 rounded-full overflow-hidden border border-gray-200 shrink-0">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop"
              alt="User profile"
              className="h-full w-full object-cover"
            />
          </div>
          <button
            onClick={onLogout}
            className="h-9 w-9 rounded-full bg-white border border-gray-200/50 hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-gray-500 hover:text-red-600 transition-all ml-1"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
