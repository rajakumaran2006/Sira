const API_BASE = '/api';

export async function fetchBatches() {
  const res = await fetch(`${API_BASE}/batches`);
  if (!res.ok) throw new Error('Failed to fetch batches');
  return res.json();
}

export async function fetchBatch(id) {
  const res = await fetch(`${API_BASE}/batches/${id}`);
  if (!res.ok) throw new Error('Failed to fetch batch details');
  return res.json();
}

export async function deleteBatch(id) {
  const res = await fetch(`${API_BASE}/batches/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete batch');
  return res.json();
}

export async function fetchBatchItems(id, status = 'All', search = '') {
  const query = new URLSearchParams();
  if (status && status !== 'All') query.append('status', status);
  if (search) query.append('search', search);
  
  const res = await fetch(`${API_BASE}/batches/${id}/items?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch batch items');
  return res.json();
}

export async function createBatch(batchName, file) {
  const formData = new FormData();
  formData.append('batchName', batchName);
  formData.append('file', file);
  
  const res = await fetch(`${API_BASE}/batches`, {
    method: 'POST',
    body: formData,
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload inventory batch');
  }
  
  return res.json();
}

export async function verifyScan(batchId, accessNo) {
  const res = await fetch(`${API_BASE}/batches/${batchId}/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ accessNo }),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to verify scanned item');
  }
  
  return res.json();
}

export function getExportUrl(batchId) {
  return `${API_BASE}/batches/${batchId}/export`;
}
