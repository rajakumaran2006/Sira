import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Database, CheckCircle2, AlertTriangle, ChevronRight, Keyboard, QrCode, Clock, Loader, ChevronDown, ChevronUp, Settings, Bell, MapPin, Tag, Users } from 'lucide-react';
import { fetchBatches, deleteBatch } from '../utils/api';
import CreateBatchModal from '../components/CreateBatchModal';
import ScannerSimulator from '../components/ScannerSimulator';

export default function Dashboard({ scannerMode, onNavigate, onShowToast }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quickScanResult, setQuickScanResult] = useState(null);
  const [quickScanHistory, setQuickScanHistory] = useState([]);
  
  // Expanded batch in right-hand column (defaults to first batch ID once loaded)
  const [expandedBatchId, setExpandedBatchId] = useState(null);

  // Weekly Scan Activity (starts with high-fidelity mock values, increments on new scans)
  const [chartData, setChartData] = useState({
    S: 15,
    M: 42,
    T: 145, // Highlighted Tuesday
    W: 64,
    T2: 98,
    F: 120,
    S2: 38
  });

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

  const handleDeleteBatch = async (e, id, name) => {
    e.stopPropagation(); // Prevent expansion toggle
    if (!window.confirm(`Are you sure you want to delete the batch "${name}"? This deletes all associated items permanently.`)) {
      return;
    }
    
    try {
      await deleteBatch(id);
      const updatedBatches = batches.filter(b => b._id !== id);
      setBatches(updatedBatches);
      onShowToast({ type: 'success', text: `Deleted batch "${name}"` });
      
      // Reset expanded batch if it was the deleted one
      if (expandedBatchId === id && updatedBatches.length > 0) {
        setExpandedBatchId(updatedBatches[0]._id);
      }
    } catch (err) {
      console.error(err);
      onShowToast({ type: 'error', text: 'Failed to delete batch.' });
    }
  };

  const handleBatchCreated = (newBatch) => {
    setBatches([newBatch, ...batches]);
    setExpandedBatchId(newBatch._id);
    onShowToast({ type: 'success', text: `Created batch "${newBatch.name}"` });
  };

  const handleQuickScan = async (scannedCode) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Increment the active day's scan activity in the chart
    const daysKeys = ['S', 'M', 'T', 'W', 'T2', 'F', 'S2'];
    const currentDayIdx = new Date().getDay(); // 0 is Sunday, 1 Monday, etc.
    const activeKey = daysKeys[currentDayIdx];
    setChartData(prev => ({
      ...prev,
      [activeKey]: prev[activeKey] + 1
    }));

    let matchedItemInfo = null;
    try {
      if (batches.length > 0) {
        // Look up item in the active batch
        const activeBatchId = expandedBatchId || batches[0]._id;
        const res = await fetch(`/api/batches/${activeBatchId}/items?search=${scannedCode}`);
        if (res.ok) {
          const items = await res.json();
          if (items.length > 0) {
            const item = items.find(i => i.accessNo === scannedCode);
            if (item) {
              matchedItemInfo = {
                title: item.title,
                location: item.location,
                author: item.authorName,
                batchName: batches.find(b => b._id === activeBatchId)?.name || 'Active Batch'
              };
            }
          }
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
  const totalAnomalies = batches.reduce((acc, curr) => acc + (curr.totalItems - (curr.foundItems + curr.notFoundItems) || 0), 0);

  // Toggle expansion of a batch card
  const toggleExpandBatch = (id) => {
    setExpandedBatchId(expandedBatchId === id ? null : id);
  };

  // Trigger auditor assignment toast
  const handleAssignAuditor = (name) => {
    onShowToast({ type: 'success', text: `${name} has been assigned to the active verification session.` });
  };

  // Chart Rendering calculations
  const maxChartVal = Math.max(...Object.values(chartData), 160);

  return (
    <div className="space-y-8 animate-pulse-subtle">
      {/* Bento Grid Layout - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* LEFT COLUMN: Activity, Team, and Quick Scan (Spans 2 cols) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Card 1: Audit Activity Weekly Chart ("Income Tracker" Style) */}
          <div className="glass-card rounded-[2rem] p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gray-100 flex items-center justify-center border border-gray-200/50">
                  <QrCode className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#1e293b]">Audit Tracker</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Track verification scans across active library sessions</p>
                </div>
              </div>

              {/* Timeframe Dropdown */}
              <div className="relative">
                <button className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 bg-white text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors">
                  <span>Week</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Weekly Bar Chart Representation */}
            <div className="h-56 mt-8 flex items-end justify-between px-2 sm:px-6 relative">
              {/* Daily scan bars */}
              {[
                { label: 'S', val: chartData.S, key: 'S' },
                { label: 'M', val: chartData.M, key: 'M' },
                { label: 'T', val: chartData.T, key: 'T', highlighted: true },
                { label: 'W', val: chartData.W, key: 'W' },
                { label: 'T', val: chartData.T2, key: 'T2' },
                { label: 'F', val: chartData.F, key: 'F' },
                { label: 'S', val: chartData.S2, key: 'S2' }
              ].map((day, idx) => {
                const heightPercentage = (day.val / maxChartVal) * 100;
                
                if (day.highlighted) {
                  return (
                    <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end relative z-10">
                      {/* Active Day Capsule (Navy overlay) */}
                      <div className="absolute inset-y-0 w-14 sm:w-16 bg-[#1e2331] rounded-full -bottom-1 flex flex-col justify-end items-center pb-12 shadow-lg shadow-slate-900/10">
                        {/* Tooltip bubble inside the capsule */}
                        <div className="absolute top-4 bg-white border border-gray-200 shadow-sm px-2.5 py-1 rounded-full text-[10px] font-extrabold text-[#1e293b]">
                          {day.val} scans
                        </div>
                        {/* Inner highlighted white dot */}
                        <div className="h-3 w-3 rounded-full bg-blue-400 ring-4 ring-blue-500/20 mb-8 z-20"></div>
                      </div>
                      
                      {/* Highlighted vertical line spacer */}
                      <div className="w-[2px] bg-gray-700/20 h-full absolute bottom-14 pointer-events-none"></div>

                      {/* Day Label inside dark circle */}
                      <span className="relative z-20 h-9 w-9 rounded-full bg-[#1e2331] flex items-center justify-center text-xs font-bold text-white border border-slate-700">
                        {day.label}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end relative">
                    {/* Dot marking value height */}
                    <div 
                      className="absolute h-2.5 w-2.5 rounded-full bg-[#8da2be] hover:bg-black hover:scale-125 transition-all cursor-pointer" 
                      style={{ bottom: `calc(${heightPercentage}% + 42px)` }}
                      title={`${day.val} scans`}
                    ></div>

                    {/* Faint vertical grid lines */}
                    <div className="w-[1.5px] bg-gray-200 h-32 absolute bottom-14 rounded-full pointer-events-none"></div>

                    {/* Standard Day Label inside gray circle */}
                    <span className="h-9 w-9 rounded-full bg-[#eef2f6] flex items-center justify-center text-xs font-bold text-gray-500 border border-transparent hover:border-gray-300 transition-colors">
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bottom growth stat */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-start gap-1">
              <span className="text-4xl font-black text-[#1e293b] tracking-tight">+24%</span>
              <p className="text-xs font-semibold text-gray-400">
                This week's audit rate is higher than last week's.
              </p>
            </div>
          </div>

          {/* Nested Grid: Audit Team & Quick Scan Station */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Card 2: Audit Team ("Let's Connect" style) */}
            <div className="glass-card rounded-[2rem] p-6 flex flex-col justify-between space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1e293b]">Let's Connect</h3>
                <a href="#" onClick={(e) => {e.preventDefault(); onShowToast({type:'info', text:'Auditor registry list coming soon.'})}} className="text-xs font-bold text-gray-400 hover:text-black transition-colors underline decoration-dotted">See all</a>
              </div>

              {/* Auditors list */}
              <div className="space-y-4">
                {/* Auditor 1 */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f8fafc] border border-gray-100 hover:scale-[1.01] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full overflow-hidden border border-gray-200">
                      <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=256&auto=format&fit=crop" alt="Randy Gouse" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-[#1e293b]">Randy Gouse</span>
                        <span className="text-[9px] font-bold text-[#f15a38] bg-orange-50 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Senior</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium">Cybersecurity specialist</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAssignAuditor('Randy Gouse')}
                    className="h-7 w-7 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-black shadow-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Auditor 2 */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f8fafc] border border-gray-100 hover:scale-[1.01] transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full overflow-hidden border border-gray-200">
                      <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=256&auto=format&fit=crop" alt="Giana Schleifer" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-[#1e293b]">Giana Schleifer</span>
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Middle</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium">UX/UI Designer</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleAssignAuditor('Giana Schleifer')}
                    className="h-7 w-7 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-black shadow-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3: Quick Scan Station (Unlock Premium Features style with dot mesh) */}
            <div className="bg-mesh-card rounded-[2rem] p-6 border border-gray-200/40 flex flex-col justify-between space-y-4 shadow-inner">
              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-[#1e2331]">Quick Scan Station</h3>
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
                <div className="p-3 bg-[#1e2331] text-white rounded-2xl space-y-1 border border-slate-700 animate-bounce-short">
                  <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-green-400">
                    <span>Scanned Code: {quickScanResult.code}</span>
                    <span className="text-slate-400 font-normal text-[8px]">{quickScanResult.time}</span>
                  </div>
                  {quickScanResult.matched ? (
                    <div className="text-[10px] leading-tight">
                      <p className="font-extrabold text-white truncate">{quickScanResult.matched.title}</p>
                      <p className="text-slate-400 truncate">{quickScanResult.matched.location || 'N/A'}</p>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic">No book found for this code.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Active Batches & Progress Summary */}
        <div className="space-y-8">
          
          {/* Card 5: Active Audit Batches ("Your Recent Projects" style) */}
          <div className="glass-card rounded-[2rem] p-6 flex flex-col justify-between space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-[#1e293b]">Your Recent Projects</h3>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-bold text-gray-400 hover:text-black transition-colors flex items-center gap-1 border border-dashed border-gray-300 hover:border-black rounded-full px-2.5 py-1 bg-white"
              >
                <Plus className="w-3 h-3" />
                <span>Upload Excel</span>
              </button>
            </div>

            {/* Batches List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Loader className="w-6 h-6 animate-spin mb-2 text-black" />
                <span className="text-xs font-bold">Loading active databases...</span>
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
              <div className="space-y-4">
                {batches.map((batch, index) => {
                  const isExpanded = expandedBatchId === batch._id;
                  const verifiedPct = batch.totalItems > 0 
                    ? Math.round((batch.foundItems / batch.totalItems) * 100)
                    : 0;

                  // Dynamic icon color based on index to match Twisty
                  let iconBg = 'bg-[#f15a38]'; // orange-red
                  if (index === 1) iconBg = 'bg-[#4f5e74]'; // slate
                  else if (index > 1) iconBg = 'bg-[#3b82f6]'; // blue

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
                              <span className="text-[9px] font-bold text-white bg-slate-900 px-2 py-0.5 rounded-full">
                                {batch.isDefault ? 'Seed' : 'Active'}
                              </span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleExpandBatch(batch._id); }}
                                className="h-6 w-6 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-black transition-colors"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Details tags */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="px-2.5 py-1 rounded-full bg-[#eef2f6] text-[9px] font-bold text-gray-600">Access List</span>
                            <span className="px-2.5 py-1 rounded-full bg-[#eef2f6] text-[9px] font-bold text-gray-600">Spreadsheet</span>
                          </div>

                          {/* Expanded Description */}
                          <p className="text-[11px] text-gray-500 leading-relaxed">
                            Verification room created on {new Date(batch.createdAt).toLocaleDateString()}. Map physical items to Access numbers.
                          </p>

                          {/* Expanded Footer Meta & Actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>Main Library</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => handleDeleteBatch(e, batch._id, batch.name)}
                                className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete Batch"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onNavigate('batch-details', batch._id)}
                                className="px-3.5 py-1.5 bg-black hover:bg-black/90 text-white rounded-full font-bold text-[10px] transition-all hover:translate-x-0.5 flex items-center gap-1"
                              >
                                <span>Verify Room</span>
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

          {/* Card 4: Audit Progress Summary ("Proposal Progress" style) */}
          <div className="glass-card rounded-[2rem] p-6 flex flex-col justify-between space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1e293b]">Proposal Progress</h3>
              <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-[#eef2f6] px-2 py-1 rounded-full border border-gray-200/10">
                <Clock className="w-3.5 h-3.5" />
                <span>Active Status</span>
              </div>
            </div>

            {/* Statistics columns */}
            <div className="grid grid-cols-3 gap-2 border-b border-gray-100 pb-6">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Items</span>
                <span className="text-2xl font-black text-[#1e293b] tracking-tight">{totalItems}</span>
              </div>
              <div className="space-y-1 border-l border-gray-100 pl-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Verified</span>
                <span className="text-2xl font-black text-[#1e293b] tracking-tight">{totalVerified}</span>
              </div>
              <div className="space-y-1 border-l border-gray-100 pl-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Anomalies</span>
                <span className="text-2xl font-black text-[#f15a38] tracking-tight">{totalAnomalies}</span>
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
                  const anomalyBound = verifiedBound + Math.round(36 * (totalItems > 0 ? totalAnomalies / totalItems : 0));
                  
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

      </div>

      {/* Upload/Create Batch Dialog Modal */}
      <CreateBatchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onBatchCreated={handleBatchCreated}
      />
    </div>
  );
}
