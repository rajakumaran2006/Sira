"use client";

import React from 'react';
import { Camera, Keyboard, Search, LogOut } from 'lucide-react';

export default function Navbar({ scannerMode, setScannerMode, currentPage, onNavigate, user, onLogout }) {
  return (
    <header className="w-full bg-[#f3f6f9] border-b border-black px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onNavigate('dashboard')}>
        <div className="h-10 w-10 rounded-full bg-[#f15a38] flex items-center justify-center shadow-md shadow-orange-500/20">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
        </div>
        <div>
          <span className="font-extrabold text-xl tracking-tight text-[#1e293b] block leading-none">SIRA</span>
          <span className="text-[9px] text-gray-400 font-semibold tracking-wider uppercase">Audit System</span>
        </div>
      </div>

      {/* Search Bar & Action Buttons */}
      <div className="flex items-center justify-end gap-3 sm:gap-4 flex-wrap md:flex-nowrap">

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



        {/* User profile info & Logout */}
        <div className="flex items-center gap-2.5 pl-2.5 border-l border-gray-200/50">
          <div className="hidden sm:block text-right">
            <span className="text-xs uppercase font-bold text-gray-800 block leading-tight">{user?.username || 'Admin'}</span>
            <span className="text-[9px] uppercase font-semibold text-black block">Admin</span>
          </div>
          <div className="h-9 w-9 rounded-full overflow-hidden border border-gray-200 shrink-0 bg-gray-100 flex items-center justify-center">
            <img
              src={user?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop"}
              alt="User profile"
              className="h-full w-full object-cover"
            />
          </div>
          <button
            onClick={onLogout}
            className="h-9 w-9 rounded-full bg-white border border-gray-200/50 hover:bg-red-600 hover:border-red-600 flex items-center justify-center text-gray-500 hover:text-white transition-all ml-1"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
