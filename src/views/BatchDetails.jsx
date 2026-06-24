"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, Search, AlertCircle, CheckCircle, Database, RefreshCw, Smartphone, Keyboard, ShieldAlert, Trash2, Check, X, ChevronDown } from 'lucide-react';
import { fetchBatch, fetchBatchItems, verifyScan, getExportUrl, updateItemStatus, deleteItem, bulkDeleteItems } from '../utils/api';
import ScannerSimulator from '../components/ScannerSimulator';
import DeleteBookModal from '../components/DeleteBookModal';
import DeleteSelectedModal from '../components/DeleteSelectedModal';
import dynamic from 'next/dynamic';

const CameraScanner = dynamic(() => import('../components/CameraScanner'), { ssr: false });

export default function BatchDetails({ batchId, scannerMode, setScannerMode, onNavigate, onShowToast }) {
  const [batch, setBatch] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('scanner'); // 'scanner' | 'list'
  
  // HID Scanner capturing refs
  const keyboardBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Flash highlight tracking
  const [flashItemId, setFlashItemId] = useState(null);
  const [flashType, setFlashType] = useState('success'); // 'success' or 'anomaly'
  const tableContainerRef = useRef(null);
  
  // Delete book modal state
  const [isDeleteBookOpen, setIsDeleteBookOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState(null);

  // Bulk selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleteSelectedOpen, setIsDeleteSelectedOpen] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  useEffect(() => {
    loadBatchData();
  }, [batchId]);

  // Hook for global keydown capturing in Desktop Mode
  useEffect(() => {
    if (scannerMode !== 'desktop') return;

    const handleGlobalKeyDown = (e) => {
      // Ignore keys if active element is standard input/textarea (like table search box or scanner helper)
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
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

      // Handle Backspace for easy manual testing / corrections
      if (e.key === 'Backspace') {
        keyboardBufferRef.current = keyboardBufferRef.current.slice(0, -1);
        return;
      }

      // Capture standard printable ASCII keys
      if (e.key.length === 1 && /[ -~]/.test(e.key)) {
        const now = Date.now();
        // Reset buffer if delay since last keypress is more than 1 second to prevent stale buffer accumulation
        if (now - lastKeyTimeRef.current > 1000) {
          keyboardBufferRef.current = '';
        }
        keyboardBufferRef.current += e.key;
        lastKeyTimeRef.current = now;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    
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
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return;
    
    // Find item locally in the current list
    const localItemIndex = items.findIndex(
      item => item.accessNo.toLowerCase() === cleanBarcode.toLowerCase()
    );

    if (localItemIndex !== -1) {
      const localItem = items[localItemIndex];
      
      if (localItem.status === 'Found') {
        // Case 1: Already verified. Show info toast and flash row instantly.
        onShowToast({ type: 'info', text: `Already verified: ${localItem.title}` });
        triggerFlash(localItem._id, 'success');
        return;
      }

      // Case 2: Found outstanding. Perform optimistic update.
      const originalStatus = localItem.status;
      const originalVerifiedAt = localItem.verifiedAt;
      const updatedVerifiedAt = new Date().toISOString();

      // Instantly update items list
      setItems(prevItems => 
        prevItems.map(item => 
          item._id === localItem._id ? { ...item, status: 'Found', verifiedAt: updatedVerifiedAt } : item
        )
      );

      // Instantly update batch counts
      setBatch(prev => ({
        ...prev,
        foundItems: prev.foundItems + 1,
        notFoundItems: Math.max(0, prev.notFoundItems - 1)
      }));

      // Instantly trigger celebration & row flash
      triggerCelebration();
      onShowToast({ 
        type: 'success', 
        text: `FOUND: ${localItem.title}` 
      });
      triggerFlash(localItem._id, 'success');

      // Sync with server in background
      try {
        const result = await verifyScan(batchId, cleanBarcode);
        if (!result.success) {
          throw new Error(result.message || 'Verification failed');
        }
      } catch (err) {
        console.error('Failed to sync scan verification:', err);
        onShowToast({ type: 'error', text: `Sync failed for: ${localItem.title}. Reverting state.` });
        
        // Revert local state
        setItems(prevItems => 
          prevItems.map(item => 
            item._id === localItem._id ? { ...item, status: originalStatus, verifiedAt: originalVerifiedAt } : item
          )
        );
        // Revert batch counts
        setBatch(prev => ({
          ...prev,
          foundItems: Math.max(0, prev.foundItems - 1),
          notFoundItems: prev.notFoundItems + 1
        }));
      }

    } else {
      // Case 3: Anomaly (not in CSV). Perform optimistic update.
      const tempId = `temp-${Date.now()}`;
      const tempItem = {
        _id: tempId,
        accessNo: cleanBarcode,
        title: `Unknown Scanned Asset [${cleanBarcode}]`,
        status: 'Not in CSV',
        verifiedAt: new Date().toISOString(),
        authorName: 'N/A',
        location: 'Scanned Anomaly'
      };

      // Instantly update state
      setItems(prev => [tempItem, ...prev]);
      setBatch(prev => ({
        ...prev,
        foundItems: (prev.foundItems || 0) + 1,
        anomaliesCount: (prev.anomaliesCount || 0) + 1
      }));

      // Instantly trigger flash and show anomaly warning toast
      onShowToast({ 
        type: 'warning', 
        text: `ANOMALY: ID [${cleanBarcode}] not in spreadsheet! Added record.` 
      });
      triggerFlash(tempId, 'anomaly');

      // Sync with server in background
      try {
        const result = await verifyScan(batchId, cleanBarcode);
        const savedItem = result.item || tempItem;
        
        // Replace temp item with the real saved item returned from DB
        setItems(prevItems => 
          prevItems.map(item => 
            item._id === tempId ? { ...savedItem, _id: savedItem._id || tempId } : item
          )
        );
      } catch (err) {
        console.error('Failed to sync anomaly scan:', err);
        onShowToast({ type: 'error', text: `Sync failed for anomaly scan [${cleanBarcode}]. Reverting.` });

        // Revert state
        setItems(prev => prev.filter(item => item._id !== tempId));
        setBatch(prev => ({
          ...prev,
          foundItems: Math.max(0, (prev.foundItems || 0) - 1),
          anomaliesCount: Math.max(0, (prev.anomaliesCount || 0) - 1)
        }));
      }
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
      const element = document.getElementById(`row-${itemId}`) || document.getElementById(`row-mobile-${itemId}`);
      if (element && tableContainerRef.current) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };



  const handleExport = () => {
    // Trigger download using hidden anchor link
    window.location.href = getExportUrl(batchId, filter);
    onShowToast({ type: 'success', text: `Exported ${filter === 'Anomalies' ? 'Not in CSV' : filter.toLowerCase()} batch data.` });
  };

  const handleToggleVerify = async (item) => {
    try {
      const isItemVerified = item.status === 'Found' || (item.status === 'Not in CSV' && item.verifiedAt);
      const newStatus = isItemVerified ? 'Not Found' : 'Found';
      const res = await updateItemStatus(item._id, newStatus);
      
      if (res.success) {
        // Update items list
        setItems(prevItems => 
          prevItems.map(prev => 
            prev._id === item._id 
              ? { 
                  ...prev, 
                  status: prev.status === 'Not in CSV' ? 'Not in CSV' : newStatus, 
                  verifiedAt: newStatus === 'Found' ? new Date().toISOString() : null 
                } 
              : prev
          )
        );
        
        // Update batch counters
        setBatch(prev => {
          const isNowFound = newStatus === 'Found';
          const wasAnomaly = item.status === 'Not in CSV';
          
          let foundDelta = isNowFound ? 1 : -1;
          let notFoundDelta = 0;
          
          if (wasAnomaly) {
            notFoundDelta = 0;
          } else {
            notFoundDelta = isNowFound ? -1 : 1;
          }
          
          return {
            ...prev,
            foundItems: Math.max(0, prev.foundItems + foundDelta),
            notFoundItems: Math.max(0, prev.notFoundItems + notFoundDelta)
          };
        });
        
        onShowToast({
          type: 'success',
          text: `Updated "${item.title}" to ${newStatus === 'Found' ? 'Verified' : 'Outstanding'}.`
        });
      }
    } catch (err) {
      console.error(err);
      onShowToast({ type: 'error', text: 'Failed to update item status.' });
    }
  };

  const handleDeleteBookClick = (item) => {
    setBookToDelete(item);
    setIsDeleteBookOpen(true);
  };

  const handleConfirmDeleteBook = async () => {
    if (!bookToDelete) return;
    // Throws on failure so DeleteBookModal can catch and show inline error
    const res = await deleteItem(bookToDelete._id);
    if (res.success) {
      // Remove from list
      setItems(prevItems => prevItems.filter(prev => prev._id !== bookToDelete._id));

      // Update batch counts
      setBatch(prev => {
        const status = bookToDelete.status;
        if (status === 'Not in CSV') {
          return {
            ...prev,
            foundItems: bookToDelete.verifiedAt ? Math.max(0, prev.foundItems - 1) : prev.foundItems,
            anomaliesCount: Math.max(0, (prev.anomaliesCount || 0) - 1)
          };
        }
        return {
          ...prev,
          totalItems: Math.max(0, prev.totalItems - 1),
          foundItems: status === 'Found' ? Math.max(0, prev.foundItems - 1) : prev.foundItems,
          notFoundItems: status === 'Not Found' ? Math.max(0, prev.notFoundItems - 1) : prev.notFoundItems
        };
      });

      setBookToDelete(null);
      onShowToast({ type: 'success', text: `Deleted book "${bookToDelete.title}" successfully.` });
    } else {
      throw new Error('Failed to delete book.');
    }
  };

  // --- Bulk selection helpers ---
  const toggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
    setSelectedIds(new Set());
  };

  const toggleSelectItem = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i._id)));
    }
  };

  const handleConfirmDeleteSelected = async () => {
    const ids = [...selectedIds];
    // Calculate stat deltas before removing from local state
    const deletedItems = items.filter(i => ids.includes(i._id));
    const totalDelta = deletedItems.filter(i => i.status !== 'Not in CSV').length;
    const foundDelta = deletedItems.filter(i => i.status === 'Found' || (i.status === 'Not in CSV' && i.verifiedAt)).length;
    const notFoundDelta = deletedItems.filter(i => i.status === 'Not Found').length;
    const anomaliesDelta = deletedItems.filter(i => i.status === 'Not in CSV').length;
    setIsDeletingSelected(true);
    try {
      // Single atomic bulk-delete request — avoids race conditions on batch stats
      await bulkDeleteItems(ids);
      setItems(prev => prev.filter(item => !ids.includes(item._id)));
      setBatch(prev => ({
        ...prev,
        totalItems: Math.max(0, prev.totalItems - totalDelta),
        foundItems: Math.max(0, prev.foundItems - foundDelta),
        notFoundItems: Math.max(0, prev.notFoundItems - notFoundDelta),
        anomaliesCount: Math.max(0, (prev.anomaliesCount || 0) - anomaliesDelta)
      }));
      setSelectedIds(new Set());
      setSelectionMode(false);
      // Auto-close modal after successful deletion
      setIsDeleteSelectedOpen(false);
      onShowToast({ type: 'success', text: `Deleted ${ids.length} record${ids.length !== 1 ? 's' : ''} successfully.` });
    } catch (err) {
      console.error(err);
      onShowToast({ type: 'error', text: `Failed to delete: ${err.message}` });
    } finally {
      setIsDeletingSelected(false);
    }
  };

  // Filter items
  // "Not in CSV" items ONLY appear in the "Not in CSV" tab — not in All, Found, or Not Found
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.accessNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.authorName && item.authorName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    const isAnomaly = item.status === 'Not in CSV';

    if (filter === 'Not in CSV') return isAnomaly;
    // For all other tabs, exclude anomalies entirely
    if (isAnomaly) return false;
    if (filter === 'All') return true;
    if (filter === 'Found') return item.status === 'Found';
    if (filter === 'Not Found') return item.status === 'Not Found';
    return true;
  });

  if (loading || !batch) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f3f6f9] z-10">
        <RefreshCw className="w-10 h-10 animate-spin mb-3 text-black" />
        <p className="text-sm uppercase font-bold text-black">Opening verification room...</p>
      </div>
    );
  }

  // Batch-wide progress metrics (for the first card)
  const totalCsvItemsCount = items.filter(i => i.status !== 'Not in CSV').length;
  const verifiedCsvCount = items.filter(i => i.status === 'Found').length;
  const foundPct = totalCsvItemsCount > 0 ? (verifiedCsvCount / totalCsvItemsCount) * 100 : 0;

  // Filtered count metrics (for the other cards) to reflect current search and tab consistently
  const anomaliesCount = filteredItems.filter(i => i.status === 'Not in CSV').length;
  const outstandingCount = filteredItems.filter(i => i.status === 'Not Found').length;
  const verifiedCount = filteredItems.filter(i => i.status === 'Found' || (i.status === 'Not in CSV' && i.verifiedAt)).length;

  // Get 3 most recently scanned/verified items for quick feedback on scanner tab on mobile
  const recentScans = items
    .filter(item => item.status === 'Found' || item.status === 'Not in CSV')
    .sort((a, b) => {
      const aTime = a.verifiedAt ? new Date(a.verifiedAt).getTime() : 0;
      const bTime = b.verifiedAt ? new Date(b.verifiedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 3);

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
          <span className='uppercase'>Export CSV</span>
        </button>
      </div>

      {/* Verification stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 sm:p-5 border border-gray-200/30 shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Verification Progress</span>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="text-2xl font-black text-black">{foundPct.toFixed(1)}%</span>
            <span className="text-[10px] text-gray-400 font-bold">({verifiedCsvCount} of {totalCsvItemsCount})</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5 border border-gray-200/30 shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Verified Assets</span>
          <div className="flex items-center gap-1.5 mt-1.5 text-black font-black text-2xl">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>{verifiedCount}</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5 border border-gray-200/30 shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Outstanding</span>
          <div className="flex items-center gap-1.5 mt-1.5 text-black font-black text-2xl">
            <Database className="w-5 h-5 shrink-0" />
            <span>{outstandingCount}</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-5 border border-gray-200/30 shadow-sm">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block">Anomalies Detected</span>
          <div className="flex items-center gap-1.5 mt-1.5 text-black font-black text-2xl">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{anomaliesCount}</span>
          </div>
        </div>
      </div>

      {/* Mobile Tab Toggle */}
      <div className="flex lg:hidden bg-gray-200/50 p-1 rounded-2xl border border-gray-200/30 w-full">
        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex-1 py-3 text-center text-xs font-black uppercase rounded-xl transition-all duration-200 ${
            activeTab === 'scanner'
              ? 'bg-white text-black shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Scanner Mode
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-3 text-center text-xs font-black uppercase rounded-xl transition-all duration-200 ${
            activeTab === 'list'
              ? 'bg-white text-black shadow-sm'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Records ({items.length})
        </button>
      </div>

      {/* Split Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: ACTIVE SCANNER VIEW */}
        <div className={`lg:col-span-4 space-y-6 lg:sticky lg:top-20 ${activeTab === 'scanner' ? 'block' : 'hidden lg:block'}`}>
          <div className="glass-card rounded-[2rem] p-6 border border-gray-200/40 shadow-sm space-y-6">
            
            {/* Scanner Mode Indicator + Dropdown */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-xs font-bold text-[#1e293b] uppercase tracking-wider">Active Scanner</h3>

              {/* Mode Dropdown */}
              <div className="relative">
                <div className="flex items-center gap-1 text-[10px] text-gray-600 font-extrabold uppercase bg-gray-100 hover:bg-gray-200 pl-2.5 pr-1.5 py-1 rounded-full border border-gray-200/50 cursor-pointer transition-colors select-none">
                  {scannerMode === 'mobile' ? (
                    <Smartphone className="w-3 h-3 text-slate-700 shrink-0" />
                  ) : (
                    <Keyboard className="w-3 h-3 text-slate-700 shrink-0" />
                  )}
                  <span>{scannerMode === 'mobile' ? 'Camera' : 'Scanner'}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
                  {/* Invisible native select overlay for accessibility & simplicity */}
                  <select
                    value={scannerMode}
                    onChange={(e) => setScannerMode(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                    aria-label="Scanner mode"
                  >
                    <option value="mobile">Camera</option>
                    <option value="desktop">Scanner (HID)</option>
                  </select>
                </div>
              </div>
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
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-[#1e293b] mb-2">
                  <Keyboard className="w-8 h-8" />
                </div>
                
                <h4 className="text-sm font-bold uppercase text-[#1e293b]">Scanner Listening...</h4>
                
                <p className="text-xs text-gray-400 max-w-[240px] leading-relaxed">
                  Plug in your USB/Bluetooth barcode reader and scan physical labels directly.
                </p>

                {/* Manual testing widget */}
                <div className="w-full pt-4 border-t border-gray-100">
                  <ScannerSimulator onScan={handleBarcodeScanned} borderless={true} />
                </div>
              </div>
            )}
          </div>

          {/* Recent Scans Widget */}
          <div className="glass-card rounded-[2rem] p-6 border border-gray-200/40 shadow-sm space-y-4 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-xs font-bold text-[#1e293b] uppercase tracking-wider">Recent Scans</h3>
              <span className="text-[10px] text-gray-400 font-bold uppercase">Latest Activity</span>
            </div>
            
            {recentScans.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-xs italic">
                No items scanned in this session yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recentScans.map((item) => (
                  <div key={item._id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100/50 text-xs transition-all">
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="font-mono text-[10px] font-bold text-gray-800">{item.accessNo}</p>
                      <p className="font-bold text-black truncate mt-0.5" title={item.title}>{item.title}</p>
                      {item.authorName && <p className="text-[10px] text-gray-400 truncate">by {item.authorName}</p>}
                    </div>
                    
                    <div className="shrink-0 text-right">
                      {item.status === 'Found' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-green-800 border border-green-800">
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-amber-800 border border-amber-800">
                          Not in CSV
                        </span>
                      )}
                      {item.verifiedAt && (
                        <p className="text-[9px] text-gray-400 font-mono mt-1">
                          {new Date(item.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: BATCH DETAILS LIVE DATA TABLE */}
        <div className={`lg:col-span-8 glass-card rounded-[2rem] overflow-hidden border border-gray-200/40 shadow-sm flex flex-col bg-white ${activeTab === 'list' ? 'flex' : 'hidden lg:flex'}`}>
          
          {/* Table Search & Filters Header */}
          <div className="p-5 border-b border-gray-100 flex flex-col gap-3 bg-white/40">
            
            {/* Search */}
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search access number or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-black text-xs font-semibold text-gray-700 transition-all placeholder:text-gray-400"
              />
            </div>
            
            {/* Filters + Delete toggle — always in a row, wraps cleanly */}
            <div className="flex items-center justify-between gap-2">
              {/* Status Segment Filters */}
              <div className="bg-gray-200/50 p-0.5 rounded-full flex items-center border border-gray-200/40 overflow-x-auto flex-1 min-w-0">
                {['All', 'Found', 'Not Found', 'Not in CSV'].map(statusFilter => (
                  <button
                    key={statusFilter}
                    onClick={() => setFilter(statusFilter)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                      filter === statusFilter
                        ? 'bg-white text-black shadow-sm'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    {statusFilter}
                  </button>
                ))}
              </div>

              {/* Bulk Delete Toggle — always right-aligned, never overflows */}
              {selectionMode && selectedIds.size > 0 ? (
                <button
                  onClick={() => setIsDeleteSelectedOpen(true)}
                  disabled={filteredItems.length === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#e11d48] text-white text-xs font-bold transition-all shadow-sm shrink-0 ${
                    filteredItems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete ({selectedIds.size})</span>
                </button>
              ) : (
                <button
                  onClick={toggleSelectionMode}
                  disabled={filteredItems.length === 0}
                  title={filteredItems.length === 0 ? 'No records to select' : selectionMode ? 'Cancel selection' : 'Select records to delete'}
                  className={`p-2 rounded-full border transition-colors shrink-0 ${
                    filteredItems.length === 0
                      ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed opacity-50'
                      : selectionMode
                        ? 'bg-gray-100 border-gray-300 text-gray-700'
                        : 'bg-white border-gray-200 text-gray-400 hover:bg-red-600 hover:border-red-600 hover:text-white'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Selection-mode banner */}
          {selectionMode && (
            <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-gray-700">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded accent-black cursor-pointer"
                  checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                  onChange={toggleSelectAll}
                />
                {selectedIds.size === filteredItems.length && filteredItems.length > 0 ? 'Deselect All' : 'Select All'}
              </label>
              <button onClick={toggleSelectionMode} className="text-gray-400 hover:text-black font-bold flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
            </div>
          )}

          {/* Scrolling Data Table */}
          <div 
            ref={tableContainerRef} 
            className="overflow-y-auto max-h-[600px] scroll-smooth"
          >
            {/* Desktop Table View */}
            <table className="hidden md:table w-full border-collapse text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-200/40 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {selectionMode && <th className="py-3.5 pl-5 pr-2 w-8"></th>}
                  <th className="py-3.5 px-5">Access No</th>
                  <th className="py-3.5 px-5">Asset Description</th>
                  <th className="py-3.5 px-5 hidden sm:table-cell">Call No / Location</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 hidden sm:table-cell">Scanned Time</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/40 text-sm">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-16 text-center text-gray-400 font-medium">
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
                        className={`hover:bg-white/40 transition-colors duration-150 ${flashClass} ${selectionMode && selectedIds.has(item._id) ? 'bg-blue-50/60' : ''}`}
                      >
                        {selectionMode && (
                          <td className="pl-5 pr-2 py-3">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded accent-black cursor-pointer"
                              checked={selectedIds.has(item._id)}
                              onChange={() => toggleSelectItem(item._id)}
                            />
                          </td>
                        )}
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
                          <div className="text-[11px] text-gray-400 mt-0.5 sm:hidden flex flex-wrap gap-x-2">
                            <span>Call: {item.callNo || 'N/A'}</span>
                            <span className="font-bold uppercase">• {item.location || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-5 text-xs text-gray-600 hidden sm:table-cell">
                          <div>{item.callNo || 'N/A'}</div>
                          <div className="text-[10px] text-gray-400 font-semibold uppercase">{item.location || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-5">
                          {item.status === 'Not in CSV' ? (
                            <div className="flex flex-col sm:flex-row gap-1 items-start sm:items-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-white bg-amber-800 border border-amber-800">
                                Not in CSV
                              </span>
                              {item.verifiedAt ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-green-800 border border-green-800 shadow-sm">
                                  Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-gray-500 bg-gray-100 border border-gray-200/50">
                                  Outstanding
                                </span>
                              )}
                            </div>
                          ) : item.status === 'Found' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white bg-green-800 border border-green-800 shadow-sm select-none">
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-gray-500 bg-gray-100 border border-gray-200/50">
                              <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                              Outstanding
                            </span>
                          )}
                          {item.verifiedAt && (
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5 sm:hidden">
                              Scanned: {new Date(item.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-5 text-xs text-gray-400 font-mono hidden sm:table-cell">
                          {item.verifiedAt ? (
                            new Date(item.verifiedAt).toLocaleTimeString()
                          ) : (
                            <span className="italic text-gray-300">Unscanned</span>
                          )}
                        </td>
                        <td className="py-3 px-5 text-right flex items-center justify-end gap-1.5">
                          {(() => {
                            const isItemVerified = item.status === 'Found' || (item.status === 'Not in CSV' && item.verifiedAt);
                            return (
                              <button
                                onClick={() => handleToggleVerify(item)}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  isItemVerified
                                    ? 'bg-amber-800 border-amber-800 text-white hover:bg-amber-700 hover:text-white'
                                    : 'bg-green-800 border-green-800 text-white hover:bg-green-700 hover:border-green-700'
                                }`}
                                title={isItemVerified ? 'Mark as Outstanding' : 'Mark as Verified'}
                              >
                                {isItemVerified ? (
                                  <X className="w-3.5 h-3.5" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                            );
                          })()}
                          {/* Delete Book */}
                          <button
                            onClick={() => handleDeleteBookClick(item)}
                            className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-red-600 text-gray-400 hover:text-white hover:border-red-600 transition-colors"
                            title="Delete Book"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-gray-100 bg-white">
              {filteredItems.length === 0 ? (
                <div className="py-16 text-center text-gray-400 font-medium">
                  {searchQuery ? 'No items matches your search query' : `No ${filter.toLowerCase()} items found.`}
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isFlashed = flashItemId === item._id;
                  const flashClass = isFlashed 
                    ? flashType === 'success' 
                      ? 'animate-flash-success border-l-4 border-l-green-500 bg-green-50/20'
                      : 'animate-flash-anomaly border-l-4 border-l-red-500 bg-red-50/20'
                    : '';
                    
                  return (
                    <div
                      key={item._id}
                      id={`row-mobile-${item._id}`}
                      className={`p-4 hover:bg-slate-50/30 transition-colors duration-150 flex flex-col gap-3 ${flashClass} ${selectionMode && selectedIds.has(item._id) ? 'bg-blue-50/60' : ''}`}
                    >
                      {selectionMode && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded accent-black cursor-pointer"
                            checked={selectedIds.has(item._id)}
                            onChange={() => toggleSelectItem(item._id)}
                          />
                          <span className="text-xs font-bold text-gray-500">Select</span>
                        </label>
                      )}
                      {/* Top row: Access Number & Status Badge */}
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-black bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200/50">
                          {item.accessNo}
                        </span>
                        
                        <div>
                          {item.status === 'Not in CSV' ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white bg-amber-800 border border-amber-800">
                                Not in CSV
                              </span>
                              {item.verifiedAt ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-white bg-green-800 border border-green-800 shadow-sm">
                                  Verified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold text-gray-500 bg-gray-100 border border-gray-200/50">
                                  Outstanding
                                </span>
                              )}
                            </div>
                          ) : item.status === 'Found' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white bg-green-800 border border-green-800 shadow-sm select-none">
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-gray-500 bg-gray-100 border border-gray-200/50">
                              <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                              Outstanding
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Author Description */}
                      <div className="space-y-0.5">
                        <h4 className="font-bold text-black text-sm leading-snug">
                          {item.title}
                        </h4>
                        {item.authorName && (
                          <p className="text-xs text-gray-400 font-medium">by {item.authorName}</p>
                        )}
                      </div>

                      {/* Footer Row: Metadata (Call No, Location, Scanned Time) & Action Buttons */}
                      <div className="flex items-end justify-between pt-2 border-t border-gray-100">
                        {/* Call No & Location & Scanned Time */}
                        <div className="text-[11px] text-gray-400 space-y-1">
                          {(item.callNo || item.location) && (
                            <div className="flex flex-wrap gap-x-2">
                              {item.callNo && (
                                <span>
                                  Call: <strong className="text-gray-700 font-semibold">{item.callNo}</strong>
                                </span>
                              )}
                              {item.location && (
                                <span>
                                  Loc: <strong className="text-slate-700 font-semibold uppercase">{item.location}</strong>
                                </span>
                              )}
                            </div>
                          )}
                          {item.verifiedAt ? (
                            <div className="font-mono text-[9px]">
                              Scanned: {new Date(item.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </div>
                          ) : (
                            <div className="italic text-gray-300">Unscanned</div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {(() => {
                            const isItemVerified = item.status === 'Found' || (item.status === 'Not in CSV' && item.verifiedAt);
                            return (
                              <button
                                onClick={() => handleToggleVerify(item)}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  isItemVerified
                                    ? 'bg-amber-800 border-amber-800 text-white hover:bg-amber-700 hover:text-white'
                                    : 'bg-green-800 border-green-800 text-white hover:bg-green-700 hover:border-green-700'
                                }`}
                                title={isItemVerified ? 'Mark as Outstanding' : 'Mark as Verified'}
                              >
                                {isItemVerified ? (
                                  <X className="w-3.5 h-3.5" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                            );
                          })()}
                          <button
                            onClick={() => handleDeleteBookClick(item)}
                            className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-red-600 text-gray-400 hover:text-white hover:border-red-600 transition-colors"
                            title="Delete Book"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          {/* Table Count Footer */}
          <div className="p-3 bg-gray-50/50 border-t border-gray-200/40 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
            Showing {filteredItems.length} of {items.length} total entries
          </div>
        </div>

      </div>

      {/* Delete Book Confirmation Modal */}
      <DeleteBookModal
        isOpen={isDeleteBookOpen}
        onClose={() => {
          setIsDeleteBookOpen(false);
          setBookToDelete(null);
        }}
        bookTitle={bookToDelete?.title || ''}
        bookAccessNo={bookToDelete?.accessNo || ''}
        onConfirm={handleConfirmDeleteBook}
      />

      {/* Bulk Delete Confirmation Modal */}
      <DeleteSelectedModal
        isOpen={isDeleteSelectedOpen}
        onClose={() => { if (!isDeletingSelected) setIsDeleteSelectedOpen(false); }}
        count={selectedIds.size}
        onConfirm={handleConfirmDeleteSelected}
        isLoading={isDeletingSelected}
      />
    </div>
  );
}
