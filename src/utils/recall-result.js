import { RECALL_STATUS } from './recall-contracts.js';

export function createRecallResultItem({
  candidate,
  score,
  rank,
  metadata = {}
} = {}) {
  return {
    candidate,
    score,
    rank,
    metadata
  };
}

export function createRecallContextPackage({
  requestId,
  results = [],
  metadata = {}
} = {}) {
  return {
    type: 'recall_context_package',
    requestId,
    items: results.map((result) => ({
      id: result.candidate.id,
      content: result.candidate.content,
      metadata: result.candidate.metadata,
      score: result.score,
      rank: result.rank
    })),
    metadata: {
      resultCount: results.length,
      ...metadata
    }
  };
}

export function createRecallResult({
  request,
  results = [],
  contextPackage,
  metadata = {}
} = {}) {
  return {
    type: 'recall_result',
    status: RECALL_STATUS.complete,
    requestId: request.id,
    results,
    contextPackage,
    error: '',
    metadata
  };
}

export function normalizeRecallError(error) {
  return error?.message || String(error || 'Recall request failed');
}
