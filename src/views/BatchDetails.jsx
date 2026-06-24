"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, Search, AlertCircle, CheckCircle, Database, RefreshCw, Smartphone, Keyboard, ShieldAlert } from 'lucide-react';
import { fetchBatch, fetchBatchItems, verifyScan, getExportUrl } from '../utils/api';
import ScannerSimulator from '../components/ScannerSimulator';
import dynamic from 'next/dynamic';

const CameraScanner = dynamic(() => import('../components/CameraScanner'), { ssr: false });

export default function BatchDetails({ batchId, scannerMode, onNavigate, onShowToast }) {
  const [batch, setBatch] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // HID Scanner capturing refs
  const [desktopScannerInput, setDesktopScannerInput] = useState('');
  const desktopInputRef = useRef(null);
  const keyboardBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Flash highlight tracking
  const [flashItemId, setFlashItemId] = useState(null);
  const [flashType, setFlashType] = useState('success'); // 'success' or 'anomaly'
  const tableContainerRef = useRef(null);

  useEffect(() => {
    loadBatchData();
  }, [batchId]);

  // Hook for global keydown capturing in Desktop Mode
  useEffect(() => {
    if (scannerMode !== 'desktop') return;

    const handleGlobalKeyDown = (e) => {
      // Ignore keys if active element is standard input/textarea (like table search box)
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl !== desktopInputRef.current) {
        return;
      }

      // Handle Enter - end of barcode
      if (e.key === 'Enter') {
        const barcode = keyboardBufferRef.current.trim();
        if (barcode) {
          handleBarcodeScanned(barcode);
        }
        keyboardBufferRef.current = '';
        return;
      }

      // Capture standard alphanumeric keys
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        const now = Date.now();
        // Standard HID barcode readers send keys in rapid succession (< 50ms)
        // If the delay is too large, it might be manual typing, but let's accumulate it anyway
        // to make testing easy.
        keyboardBufferRef.current += e.key;
        lastKeyTimeRef.current = now;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    
    // Auto-focus our desktop input helper to make scanning resilient
    if (desktopInputRef.current) {
      desktopInputRef.current.focus();
    }

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [scannerMode, items, batch]);

  const loadBatchData = async () => {
    setLoading(true);
    try {
      const batchData = await fetchBatch(batchId);
      const itemsData = await fetchBatchItems(batchId);
      setBatch(batchData);
      setItems(itemsData);
    } catch (err) {
      console.error(err);
      onShowToast({ type: 'error', text: 'Failed to load batch records.' });
      onNavigate('dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanned = async (barcode) => {
    if (!barcode) return;
    
    try {
      const result = await verifyScan(batchId, barcode);
      
      if (result.success) {
        // Success match in CSV list
        if (result.alreadyVerified) {
          onShowToast({ type: 'info', text: `Already verified: ${result.item.title}` });
          triggerFlash(result.item._id, 'success');
        } else {
          // Play mini celebration
          triggerCelebration();
          onShowToast({ 
            type: 'success', 
            text: `FOUND: ${result.item.title}` 
          });
          
          // Update item in local list
          setItems(prevItems => 
            prevItems.map(item => 
              item._id === result.item._id ? { ...item, status: 'Found', verifiedAt: result.item.verifiedAt } : item
            )
          );
          
          // Update batch counts
          setBatch(prev => ({
            ...prev,
            foundItems: prev.foundItems + 1,
            notFoundItems: Math.max(0, prev.notFoundItems - 1)
          }));
          
          triggerFlash(result.item._id, 'success');
        }
      } else {
        // Anomaly: not in CSV
        onShowToast({ 
          type: 'warning', 
          text: `ANOMALY: ID [${barcode}] not in spreadsheet! Added record.` 
        });
        
        // Add new anomaly item to front of the local list
        setItems(prev => [result.item, ...prev]);
        
        // Update batch total count
        setBatch(prev => ({
          ...prev,
          totalItems: prev.totalItems + 1
        }));
        
        triggerFlash(result.item._id, 'anomaly');
      }
    } catch (err) {
      console.error(err);
      onShowToast({ type: 'error', text: err.message || 'Verification scan failed.' });
    }
  };

  const triggerCelebration = async () => {
    const confetti = (await import('canvas-confetti')).default;
    // Greenish success confetti burst
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#22c55e', '#3b82f6', '#10b981']
    });
  };

  const triggerFlash = (itemId, type) => {
    setFlashItemId(itemId);
    setFlashType(type);
    
    // Clear flash after animation finishes (1.5s)
    setTimeout(() => {
      setFlashItemId(null);
    }, 1500);

    // Scroll the scanned item into view inside the table container
    setTimeout(() => {
      const element = document.getElementById(`row-${itemId}`);
      if (element && tableContainerRef.current) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  const handleDesktopInputSubmit = (e) => {
    e.preventDefault();
    if (desktopScannerInput.trim()) {
      handleBarcodeScanned(desktopScannerInput.trim());
      setDesktopScannerInput('');
    }
  };

  const handleExport = () => {
    // Trigger download using hidden anchor link
    window.location.href = getExportUrl(batchId);
    onShowToast({ type: 'success', text: 'Exported verified batch data.' });
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.accessNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.authorName && item.authorName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filter === 'All') return true;
    if (filter === 'Found') return item.status === 'Found';
    if (filter === 'Not Found') return item.status === 'Not Found';
    if (filter === 'Anomalies') return item.status === 'Not in CSV';
    return true;
  });

  if (loading || !batch) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-gray-400">
        <RefreshCw className="w-10 h-10 animate-spin mb-3 text-black" />
        <p className="text-sm font-bold text-black">Opening verification room...</p>
      </div>
    );
  }

  const foundPct = batch.totalItems > 0 ? (batch.foundItems / batch.totalItems) * 100 : 0;
  const anomaliesCount = items.filter(i => i.status === 'Not in CSV').length;

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200/30 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('dashboard')}
            className="h-9 w-9 rounded-full bg-white border border-gray-200/60 hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all shadow-sm"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div>
            <h1 className="text-xl font-black tracking-tight text-[#1e293b] flex items-center gap-2">
              <span>{batch.name}</span>
            </h1>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Batch Verification Room</p>
          </div>
        </div>
        
        {/* Export Button */}
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-[#1e293b] font-extrabold text-xs shadow-sm transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Batch CSV</span>
        </button>
      </div>

      {/* Verification stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-gray-200/30 shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Verification Progress</span>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="text-2xl font-black text-[#1e293b]">{foundPct.toFixed(1)}%</span>
            <span className="text-[10px] text-gray-400 font-bold">({batch.foundItems} of {batch.totalItems})</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-gray-200/30 shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Verified Assets</span>
          <div className="flex items-center gap-1.5 mt-1.5 text-green-600 font-black text-2xl">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>{batch.foundItems}</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-gray-200/30 shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Outstanding</span>
          <div className="flex items-center gap-1.5 mt-1.5 text-gray-400 font-black text-2xl">
            <Database className="w-5 h-5 shrink-0" />
            <span>{batch.notFoundItems}</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-gray-200/30 shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Anomalies Detected</span>
          <div className="flex items-center gap-1.5 mt-1.5 text-[#f15a38] font-black text-2xl">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{anomaliesCount}</span>
          </div>
        </div>
      </div>

      {/* Split Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: ACTIVE SCANNER VIEW */}
        <div className="lg:col-span-4 space-y-6 sticky top-20">
          <div className="glass-card rounded-[2rem] p-6 border border-gray-200/40 shadow-sm space-y-6">
            
            {/* Scanner Mode Indicator */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-[#1e293b] uppercase tracking-wider">Active Scanner</h3>
              <span className="flex items-center gap-1 text-[10px] text-gray-500 font-extrabold uppercase bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200/10">
                {scannerMode === 'mobile' ? (
                  <>
                    <Smartphone className="w-3.5 h-3.5 text-slate-700" />
                    Camera Mode
                  </>
                ) : (
                  <>
                    <Keyboard className="w-3.5 h-3.5 text-slate-700 animate-pulse" />
                    Desktop Mode
                  </>
                )}
              </span>
            </div>

            {/* SCANNER PANEL RENDERING */}
            {scannerMode === 'mobile' ? (
              <div className="space-y-4">
                <CameraScanner onScan={handleBarcodeScanned} isActive={scannerMode === 'mobile'} />
                
                {/* Fallback Simulator in Mobile Mode for desktop convenience */}
                <div className="pt-2">
                  <ScannerSimulator onScan={handleBarcodeScanned} borderless={false} />
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4 text-center flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-[#1e293b] mb-2 relative">
                  <Keyboard className="w-8 h-8" />
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-green-500 border-2 border-white rounded-full animate-ping"></span>
                </div>
                
                <h4 className="text-sm font-bold text-[#1e293b]">Scanner Listening...</h4>
                
                <p className="text-xs text-gray-400 max-w-[240px] leading-relaxed">
                  Plug in your USB/Bluetooth barcode reader. Focus this field, then scan physical labels.
                </p>
                
                {/* Desktop Hidden input helper form that helps capture scanner inputs */}
                <form onSubmit={handleDesktopInputSubmit} className="w-full pt-4 space-y-3">
                  <div className="relative">
                    <input
                      ref={desktopInputRef}
                      type="text"
                      placeholder="HID Reader capture field..."
                      value={desktopScannerInput}
                      onChange={(e) => setDesktopScannerInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-full border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black text-xs font-mono text-center text-gray-700 transition-all placeholder:text-gray-400"
                      onBlur={() => {
                        // Maintain focus on this box in desktop scanner mode
                        setTimeout(() => {
                          if (scannerMode === 'desktop' && desktopInputRef.current) {
                            desktopInputRef.current.focus();
                          }
                        }, 500);
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-full bg-black hover:bg-black/90 text-white font-bold text-xs transition-colors shadow-sm"
                  >
                    Send Input Manual Key
                  </button>
                </form>

                {/* Manual testing widget */}
                <div className="w-full pt-4 border-t border-gray-100">
                  <ScannerSimulator onScan={handleBarcodeScanned} borderless={true} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: BATCH DETAILS LIVE DATA TABLE */}
        <div className="lg:col-span-8 glass-card rounded-[2rem] overflow-hidden border border-gray-200/40 shadow-sm flex flex-col bg-white">
          
          {/* Table Search & Filters Header */}
          <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40">
            
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search access number or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black text-xs font-semibold text-gray-700 transition-all placeholder:text-gray-400"
              />
            </div>
            
            {/* Status Segment Filters */}
            <div className="bg-gray-200/50 p-0.5 rounded-full flex items-center border border-gray-200/40 overflow-x-auto self-start md:self-auto">
              {['All', 'Found', 'Not Found', 'Anomalies'].map(statusFilter => (
                <button
                  key={statusFilter}
                  onClick={() => setFilter(statusFilter)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                    filter === statusFilter
                      ? 'bg-white text-black shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {statusFilter === 'Anomalies' ? 'Not in CSV' : statusFilter}
                </button>
              ))}
            </div>
          </div>

          {/* Scrolling Data Table */}
          <div 
            ref={tableContainerRef} 
            className="overflow-x-auto max-h-[600px] scroll-smooth"
          >
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-200/40 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Access No</th>
                  <th className="py-3.5 px-5">Asset Description</th>
                  <th className="py-3.5 px-5">Call No / Location</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5">Scanned Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/40 text-sm">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-16 text-center text-gray-400 font-medium">
                      {searchQuery ? 'No items matches your search query' : `No ${filter.toLowerCase()} items found.`}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isFlashed = flashItemId === item._id;
                    const flashClass = isFlashed 
                      ? flashType === 'success' 
                        ? 'animate-flash-success border-l-4 border-l-green-500'
                        : 'animate-flash-anomaly border-l-4 border-l-red-500'
                      : '';
                      
                    return (
                      <tr
                        key={item._id}
                        id={`row-${item._id}`}
                        className={`hover:bg-white/40 transition-colors duration-150 ${flashClass}`}
                      >
                        <td className="py-3 px-5 font-mono text-xs font-bold text-black">
                          {item.accessNo}
                        </td>
                        <td className="py-3 px-5 max-w-[250px]">
                          <div className="font-bold text-black truncate" title={item.title}>
                            {item.title}
                          </div>
                          {item.authorName && (
                            <div className="text-xs text-gray-400 truncate">
                              by {item.authorName}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-5 text-xs text-gray-600">
                          <div>{item.callNo || 'N/A'}</div>
                          <div className="text-[10px] text-gray-400 font-semibold uppercase">{item.location || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-5">
                          {item.status === 'Found' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-green-700 bg-green-50 border border-green-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                              Verified
                            </span>
                          ) : item.status === 'Not in CSV' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                              Not in CSV
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-gray-500 bg-gray-100 border border-gray-200/50">
                              <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                              Outstanding
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-xs text-gray-400 font-mono">
                          {item.verifiedAt ? (
                            new Date(item.verifiedAt).toLocaleTimeString()
                          ) : (
                            <span className="italic text-gray-300">Unscanned</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* Table Count Footer */}
          <div className="p-3 bg-gray-50/50 border-t border-gray-200/40 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
            Showing {filteredItems.length} of {items.length} total entries
          </div>
        </div>

      </div>
    </div>
  );
}
