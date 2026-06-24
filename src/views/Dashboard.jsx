import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Database, ChevronRight, Clock, Loader, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { fetchBatches, deleteBatch } from '../utils/api';
import CreateBatchModal from '../components/CreateBatchModal';
import DeleteBatchModal from '../components/DeleteBatchModal';
import ScannerSimulator from '../components/ScannerSimulator';

export default function Dashboard({ scannerMode, onNavigate, onShowToast }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quickScanResult, setQuickScanResult] = useState(null);
  const [quickScanHistory, setQuickScanHistory] = useState([]);
  
  // Expanded batch in right-hand column (defaults to first batch ID once loaded)
  const [expandedBatchId, setExpandedBatchId] = useState(null);

  // Delete batch state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [batchToDelete, setBatchToDelete] = useState(null);



  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const data = await fetchBatches();
      setBatches(data);
      if (data.length > 0) {
        // Expand the first batch by default
        setExpandedBatchId(data[0]._id);
      }
    } catch (err) {
      console.error(err);
      onShowToast({ type: 'error', text: 'Failed to load batches.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBatchClick = (e, id, name) => {
    e.stopPropagation(); // Prevent expansion toggle
    setBatchToDelete({ id, name });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!batchToDelete) return;
    const { id, name } = batchToDelete;
    
    await deleteBatch(id);
    const updatedBatches = batches.filter(b => b._id !== id);
    setBatches(updatedBatches);
    onShowToast({ type: 'success', text: `Deleted batch "${name}" and all its data` });
    
    // Reset expanded batch if it was the deleted one
    if (expandedBatchId === id && updatedBatches.length > 0) {
      setExpandedBatchId(updatedBatches[0]._id);
    } else if (updatedBatches.length === 0) {
      setExpandedBatchId(null);
    }
  };

  const handleBatchCreated = (newBatch) => {
    setBatches([newBatch, ...batches]);
    setExpandedBatchId(newBatch._id);
    onShowToast({ type: 'success', text: `Created batch "${newBatch.name}"` });
  };

  const handleQuickScan = async (scannedCode) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    let matchedItemInfo = null;
    try {
      if (batches.length > 0) {
        // Fetch matches from all batches in parallel
        const matchPromises = batches.map(async (batch) => {
          try {
            const res = await fetch(`/api/batches/${batch._id}/items?search=${scannedCode}`);
            if (res.ok) {
              const items = await res.json();
              const item = items.find(i => i.accessNo.toLowerCase() === scannedCode.toLowerCase());
              if (item) {
                return { item, batchName: batch.name };
              }
            }
          } catch (err) {
            console.warn(`Quick scan lookup in batch ${batch.name} failed:`, err);
          }
          return null;
        });

        const results = (await Promise.all(matchPromises)).filter(Boolean);

        if (results.length > 0) {
          // Use the first matched item details for basic info
          const firstMatch = results[0].item;
          // Combine all batch names
          const batchNames = results.map(r => r.batchName);
          matchedItemInfo = {
            title: firstMatch.title,
            location: firstMatch.location,
            author: firstMatch.authorName,
            batchNames: batchNames // list of all batch names containing this item
          };
        }
      }
    } catch (e) {
      console.warn('Quick scan match lookup failed', e);
    }

    const result = {
      code: scannedCode,
      time: timestamp,
      matched: matchedItemInfo
    };

    setQuickScanResult(result);
    setQuickScanHistory(prev => [result, ...prev].slice(0, 4)); // Keep last 4
    onShowToast({ type: 'success', text: `Quick scanned barcode: ${scannedCode}` });
  };

  // Compute aggregate stats
  const totalVerified = batches.reduce((acc, curr) => acc + (curr.foundItems || 0), 0);
  const totalItems = batches.reduce((acc, curr) => acc + (curr.totalItems || 0), 0);
  const totalAnomalies = batches.reduce((acc, curr) => acc + (curr.anomaliesCount || (curr.totalItems - (curr.foundItems + curr.notFoundItems)) || 0), 0);

  // Toggle expansion of a batch card
  const toggleExpandBatch = (id) => {
    setExpandedBatchId(expandedBatchId === id ? null : id);
  };



  return (
    <>
      <div className="space-y-8">
        {/* Bento Grid Layout - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT COLUMN: Quick Scan Station & Proposal Progress (Spans 2 cols) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Card 1: Quick Scan Station (Unlock Premium Features style with dot mesh) */}
          <div className="bg-mesh-card rounded-[2rem] p-6 border border-gray-200/40 flex flex-col justify-between space-y-4 shadow-inner">
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold uppercase text-[#1e2331]">Quick Scan Station</h3>
              <p className="text-xs text-[#52647c] leading-relaxed">
                Verify inventory codes on the fly to inspect title details instantly without committing logs.
              </p>
            </div>

            {/* Injected Simulator with customized layout */}
            <div className="bg-white/90 p-4 rounded-2xl border border-white/60 shadow-sm">
              <ScannerSimulator onScan={handleQuickScan} borderless={true} />
            </div>

            {/* Quick Scan Result Popdown */}
            {quickScanResult && (
              <div className="p-3 bg-[#1e2331] text-white rounded-2xl space-y-1 border border-slate-700">
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-green-400">
                  <span>Scanned Code: {quickScanResult.code}</span>
                  <span className="text-slate-400 font-normal text-[8px]">{quickScanResult.time}</span>
                </div>
                {quickScanResult.matched ? (
                  <div className="text-[10px] leading-tight space-y-1.5">
                    <p className="font-extrabold text-white truncate">{quickScanResult.matched.title}</p>
                    <p className="text-slate-400 truncate">{quickScanResult.matched.location || 'N/A'}</p>
                    {quickScanResult.matched.batchNames && quickScanResult.matched.batchNames.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-800">
                        <span className="text-[8px] font-bold uppercase text-slate-500">Batches:</span>
                        <div className="flex flex-wrap gap-1">
                          {quickScanResult.matched.batchNames.map((name, i) => (
                            <span key={i} className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">No book found for this code.</p>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Audit Progress Summary ("Proposal Progress" style) */}
          <div className="glass-card rounded-[2rem] p-6 flex flex-col justify-between space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold  uppercase text-[#1e293b]">Overall Progress</h3>

            </div>

            {/* Statistics columns */}
            <div className="grid grid-cols-3 gap-2 border-b border-gray-100 pb-6">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Items</span>
                <span className="text-2xl font-black text-black tracking-tight">{totalItems}</span>
              </div>
              <div className="space-y-1 border-l border-gray-100 pl-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Verified</span>
                <span className="text-2xl font-black text-black tracking-tight">{totalVerified}</span>
              </div>
              <div className="space-y-1 border-l border-gray-100 pl-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Anomalies</span>
                <span className="text-2xl font-black text-black tracking-tight">{totalAnomalies}</span>
              </div>
            </div>

            {/* Custom Stripes Distribution Graphic */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Verified Ratio Output</span>
              
              {/* Stripe matrix - renders about 36 thin stripes */}
              <div className="flex items-end justify-between h-12 w-full px-1">
                {Array.from({ length: 36 }).map((_, idx) => {
                  // Determine status proportion
                  // Verified: Greenish-black, Anomalies: Orange-red, Remaining: Gray
                  const verifiedBound = Math.round(36 * (totalItems > 0 ? totalVerified / totalItems : 0));
                  const anomalyBound = Math.min(36, verifiedBound + Math.round(36 * (totalItems > 0 ? totalAnomalies / totalItems : 0)));
                  
                  let stripeColor = 'bg-gray-200'; // Outstanding
                  if (idx < verifiedBound) {
                    stripeColor = 'bg-[#1e2331]'; // Verified (dark navy-black)
                  } else if (idx < anomalyBound) {
                    stripeColor = 'bg-[#f15a38]'; // Anomaly (orange-red)
                  }

                  // Slightly alternate stripe heights for high-fidelity audio-wave look
                  const height = idx % 2 === 0 ? 'h-full' : 'h-4/5';

                  return (
                    <div 
                      key={idx} 
                      className={`w-[2.5px] ${height} ${stripeColor} rounded-full transition-all duration-300`}
                    ></div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Batches with scroll option */}
        <div className="space-y-8">
          
          {/* Card 3: Batches List */}
          <div className="glass-card rounded-[2rem] p-6 flex flex-col justify-between space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold uppercase text-[#1e293b]">Batches</h3>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-bold text-black uppercase transition-colors flex items-center gap-1 border border-dashed border-gray-300 hover:border-black rounded-full px-2.5 py-1 bg-white"
              >
                <Plus className="w-3 h-3" />
                <span>Create Batch</span>
              </button>
            </div>

            {/* Batches List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Loader className="w-6 h-6 animate-spin mb-2 text-black" />
                <span className="text-xs uppercase font-bold">Loading active databases...</span>
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-10 bg-[#f8fafc] border border-gray-200 border-dashed rounded-2xl">
                <Database className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="text-xs font-extrabold text-gray-500">No active batches</p>
                <p className="text-[10px] text-gray-400 mt-1 max-w-[200px] mx-auto">
                  Drag and drop a library excel sheet to initialize auditing.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                {batches.map((batch, index) => {
                  const isExpanded = expandedBatchId === batch._id;
                  const verifiedPct = batch.totalItems > 0 
                    ? Math.round((batch.foundItems / batch.totalItems) * 100)
                    : 0;

                  // All batch icons use the same orange-red color
                  const iconBg = 'bg-[#f15a38]';

                  return (
                    <div 
                      key={batch._id}
                      className={`rounded-2xl border transition-all duration-300 ${
                        isExpanded 
                          ? 'bg-[#f8fafc] border-gray-200 p-4 space-y-4 shadow-sm' 
                          : 'bg-white border-gray-100 p-3 hover:bg-gray-50/50 cursor-pointer flex items-center justify-between'
                      }`}
                      onClick={() => !isExpanded && toggleExpandBatch(batch._id)}
                    >
                      {/* Expanded View Card */}
                      {isExpanded ? (
                        <div className="space-y-3">
                          {/* Expanded Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`h-9 w-9 rounded-xl ${iconBg} flex items-center justify-center text-white shadow-sm`}>
                                <Database className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-sm font-extrabold text-[#1e293b] truncate max-w-[140px]">{batch.name}</h4>
                                <span className="text-[10px] text-gray-400 font-bold">{verifiedPct}% verified</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleExpandBatch(batch._id); }}
                                className="h-6 w-6 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-black transition-colors"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>


                          {/* Expanded Description */}
                          <p className="text-[11px] text-gray-500 leading-relaxed">
                            Verification room created on {new Date(batch.createdAt).toLocaleDateString()}.
                          </p>

                          {/* Expanded Footer Meta & Actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>IT Dept Library</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => handleDeleteBatchClick(e, batch._id, batch.name)}
                                className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-red-600 text-gray-400 hover:text-white hover:border-red-600 transition-colors"
                                title="Delete Batch"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onNavigate('batch-details', batch._id)}
                                className="px-3.5 py-1.5 uppercase bg-black hover:bg-black/90 text-white rounded-full font-bold text-[10px] transition-all flex items-center gap-1"
                              >
                                <span>View</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Collapsed View Row */
                        <>
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-xl ${iconBg} flex items-center justify-center text-white`}>
                              <Database className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <h4 className="text-xs font-extrabold text-[#1e293b] truncate max-w-[140px]">{batch.name}</h4>
                              <p className="text-[9px] text-gray-400 font-bold">{batch.totalItems} books</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-gray-500 bg-[#eef2f6] px-2 py-0.5 rounded-full">
                              {verifiedPct}%
                            </span>
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

      </div>

      {/* Upload/Create Batch Dialog Modal */}
      <CreateBatchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onBatchCreated={handleBatchCreated}
      />

      {/* Delete Batch Confirmation Modal */}
      <DeleteBatchModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setBatchToDelete(null);
        }}
        batchName={batchToDelete?.name || ''}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
