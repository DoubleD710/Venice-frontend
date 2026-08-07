import {
  createRecallError,
  createRecallEvent,
  createRecallRequest,
  createRecallScore,
  RECALL_LIFECYCLE,
  validateRecallRequest
} from './recall-contracts.js';
import {
  createRecallContextPackage,
  createRecallResult,
  createRecallResultItem,
  normalizeRecallError
} from './recall-result.js';

function dotProduct(left, right) {
  return left.reduce((total, value, index) => total + value * (right[index] || 0), 0);
}

function magnitude(vector) {
  return Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
}

export function calculateSimilarityScore(queryVector, candidateVector) {
  if (queryVector.length === 0 || candidateVector.length === 0) {
    return 0;
  }

  const denominator = magnitude(queryVector) * magnitude(candidateVector);

  if (!denominator) {
    return 0;
  }

  return dotProduct(queryVector, candidateVector) / denominator;
}

export function calculateRecencyScore(candidate, nowMs = Date.now()) {
  const rawTimestamp = candidate.metadata?.timestamp
    || candidate.metadata?.updatedAt
    || candidate.metadata?.createdAt;
  const timestampMs = rawTimestamp ? Date.parse(rawTimestamp) : 0;

  if (!timestampMs || Number.isNaN(timestampMs)) {
    return 0;
  }

  const ageDays = Math.max(0, (nowMs - timestampMs) / 86400000);

  return 1 / (1 + ageDays);
}

function createDefaultStrategies(nowProvider) {
  return {
    similarity({ queryVector, candidate }) {
      const similarity = calculateSimilarityScore(queryVector, candidate.embedding);

      return createRecallScore({
        similarity,
        weighted: similarity
      });
    },
    recency({ candidate }) {
      const recency = calculateRecencyScore(candidate, nowProvider());

      return createRecallScore({
        recency,
        weighted: recency
      });
    },
    weighted({ queryVector, candidate, request }) {
      const similarity = calculateSimilarityScore(queryVector, candidate.embedding);
      const recency = calculateRecencyScore(candidate, nowProvider());
      const similarityWeight = request.rankingWeights.similarity;
      const recencyWeight = request.rankingWeights.recency;

      return createRecallScore({
        similarity,
        recency,
        weighted: similarity * similarityWeight + recency * recencyWeight,
        metadata: {
          similarityWeight,
          recencyWeight
        }
      });
    }
  };
}

function normalizeStrategyScore(score) {
  if (typeof score === 'number') {
    return createRecallScore({
      similarity: score,
      weighted: score
    });
  }

  return createRecallScore(score);
}

export function createRecallRuntime(options = {}) {
  const nowProvider = options.nowProvider || (() => Date.now());
  const rankingStrategies = {
    ...createDefaultStrategies(nowProvider),
    ...(options.rankingStrategies || {})
  };
  const listeners = new Set();
  let requestCount = 0;
  let lastStatus = 'idle';

  function emit(event) {
    lastStatus = event.phase || lastStatus;
    listeners.forEach((listener) => listener(event));
  }

  function onEvent(listener) {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  function rankCandidates(request) {
    const strategy = rankingStrategies[request.rankingStrategy];

    if (!strategy) {
      throw new Error(`Unknown recall ranking strategy: ${request.rankingStrategy}`);
    }

    return request.candidates
      .map((candidate, index) => ({
        candidate,
        score: normalizeStrategyScore(strategy({
          queryVector: request.queryEmbedding,
          candidate,
          index,
          request
        }))
      }))
      .sort((left, right) => right.score.weighted - left.score.weighted);
  }

  function selectTopCandidates(rankedCandidates, topK) {
    return rankedCandidates
      .slice(0, topK)
      .map((item, index) => createRecallResultItem({
        candidate: item.candidate,
        score: item.score,
        rank: index + 1
      }));
  }

  function recall(optionsForRequest = {}) {
    const request = createRecallRequest(optionsForRequest);

    emit(createRecallEvent(RECALL_LIFECYCLE.requested, request));

    const validation = validateRecallRequest(request);

    if (!validation.ok) {
      const result = createRecallError(request, validation.errors[0]);

      emit(createRecallEvent(RECALL_LIFECYCLE.error, request, { message: result.error }));
      return result;
    }

    emit(createRecallEvent(RECALL_LIFECYCLE.validated, request));

    try {
      const rankedCandidates = rankCandidates(request);

      emit(createRecallEvent(RECALL_LIFECYCLE.ranked, request, {
        candidateCount: rankedCandidates.length
      }));

      const selectedResults = selectTopCandidates(rankedCandidates, request.topK);

      emit(createRecallEvent(RECALL_LIFECYCLE.selected, request, {
        selectedCount: selectedResults.length
      }));

      const contextPackage = createRecallContextPackage({
        requestId: request.id,
        results: selectedResults,
        metadata: {
          rankingStrategy: request.rankingStrategy
        }
      });

      emit(createRecallEvent(RECALL_LIFECYCLE.packaged, request, {
        itemCount: contextPackage.items.length
      }));

      requestCount += 1;
      emit(createRecallEvent(RECALL_LIFECYCLE.completed, request));

      return createRecallResult({
        request,
        results: selectedResults,
        contextPackage,
        metadata: {
          rankingStrategy: request.rankingStrategy,
          candidateCount: request.candidates.length
        }
      });
    } catch (error) {
      const result = createRecallError(request, normalizeRecallError(error));

      emit(createRecallEvent(RECALL_LIFECYCLE.error, request, { message: result.error }));
      return result;
    }
  }

  function recallFromEmbeddingResult(embeddingResult, optionsForRequest = {}) {
    return recall({
      ...optionsForRequest,
      queryEmbedding: embeddingResult?.embeddings?.[0]
    });
  }

  function getDiagnostics() {
    return {
      requestCount,
      lastStatus,
      rankingStrategies: Object.keys(rankingStrategies)
    };
  }

  return {
    recall,
    recallFromEmbeddingResult,
    onEvent,
    getDiagnostics
  };
}
