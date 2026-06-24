"use client";

import React, { useContext } from 'react';
import { useParams, useRouter } from 'next/navigation';
import BatchDetails from '../../../views/BatchDetails';
import { AppContext } from '../../../components/ClientAppWrapper';

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const context = useContext(AppContext);

  if (!context) return null;

  const { scannerMode, setScannerMode, showToast } = context;

  const handleNavigate = (page, batchId = null) => {
    if (page === 'dashboard') {
      router.push('/');
    } else if (page === 'batch-details' || page === 'batchDetails') {
      router.push(`/batches/${batchId}`);
    }
  };

  return (
    <BatchDetails
      batchId={params.id}
      scannerMode={scannerMode}
      setScannerMode={setScannerMode}
      onNavigate={handleNavigate}
      onShowToast={showToast}
    />
  );
}
