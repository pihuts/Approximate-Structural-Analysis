import { StructureInput, AnalysisResult, FastAnalysisResult } from './types';

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:8000';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new ApiError(res.status, `API Error (${res.status}): ${body}`);
  }
  return res.json();
}

export async function analyzeStructure(
  params: StructureInput
): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse<AnalysisResult>(res);
}

export async function analyzeFast(
  params: StructureInput
): Promise<FastAnalysisResult> {
  const res = await fetch(`${API_BASE}/api/analyze/fast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return handleResponse<FastAnalysisResult>(res);
}

export async function getAiscSections(): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/aisc-sections`);
  return handleResponse<unknown>(res);
}

export { ApiError };
