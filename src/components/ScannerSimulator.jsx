"use client";

import React, { useState } from 'react';
import { Keyboard, ArrowRight } from 'lucide-react';

export default function ScannerSimulator({ onScan, borderless = false }) {
  const [accessNo, setAccessNo] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!accessNo.trim()) return;
    onScan(accessNo.trim());
    setAccessNo('');
  };

  const handleQuickTest = (value) => {
    onScan(value);
  };

  return (
    <div className={`${borderless ? 'p-0 bg-transparent border-0' : 'glass-card rounded-3xl p-5 border border-gray-100 space-y-4'}`}>
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-gray-200/60 flex items-center justify-center border border-gray-200/50">
          <Keyboard className="w-3.5 h-3.5 text-gray-700" />
        </div>
        <h4 className="text-xs uppercase font-bold text-[#1e293b]">Mannual Input</h4>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          placeholder="Enter Access No (e.g., 10087)"
          value={accessNo}
          onChange={(e) => setAccessNo(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black text-xs font-semibold text-gray-700 transition-all placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={!accessNo.trim()}
          className="px-4 py-2.5 rounded-full bg-black hover:bg-black/90 disabled:bg-gray-100 text-white disabled:text-gray-400 font-bold text-xs transition-all flex items-center gap-1 shrink-0"
        >
          <span>Search</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
