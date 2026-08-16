import { createMemoryOperationExecutor } from '../src/utils/memory-operation-executor.js';
import { MEMORY_MERGE_POLICIES, MEMORY_OPERATION_TYPES } from '../src/utils/memory-operation-contracts.js';
import { createMemoryOperationProcessor } from '../src/utils/memory-operations.js';
import { createMemoryRuntime } from '../src/utils/memory-runtime.js';
import { MEMORY_TYPES } from '../src/utils/memory-types.js';

function createCandidate(id, evidence) {
  return {
    id,
    source: `demo:${id}`,
    category: MEMORY_TYPES.preference,
    confidence: 0.9,
    evidence: [evidence],
    metadata: {
      demo: true
    }
  };
}

function createOperation(overrides = {}) {
  return {
    operationId: 'demo-operation',
    idempotencyKey: '',
    operationType: MEMORY_OPERATION_TYPES.put,
    targetMemoryIds: [],
    payload: {},
    proposalMetadata: {
      proposedBy: 'memory-core-demo'
    },
    timestamp: '2026-08-13T00:00:00.000Z',
    validationStatus: 'pending',
    ...overrides
  };
}

function propose(processor, operation) {
  const proposal = processor.propose(operation);

  if (proposal.status !== 'valid') {
    return proposal;
  }

  return proposal.operation;
}

const runtime = createMemoryRuntime();
const executor = createMemoryOperationExecutor({ runtime });
const processor = createMemoryOperationProcessor();

const putPrimary = executor.execute(propose(processor, createOperation({
  operationId: 'demo-put-primary',
  idempotencyKey: 'demo-put-primary',
  payload: {
    candidate: createCandidate('candidate-primary', 'User prefers local-first tools.'),
    card: {
      id: 'demo-card-primary',
      summary: 'User prefers local-first tools.',
      tags: ['local-first']
    }
  }
})));

const updatePrimary = executor.execute(propose(processor, createOperation({
  operationId: 'demo-update-primary',
  operationType: MEMORY_OPERATION_TYPES.update,
  targetMemoryIds: ['demo-card-primary'],
  payload: {
    updates: {
      summary: 'User strongly prefers local-first architecture.',
      tags: ['local-first', 'architecture']
    }
  }
})));

executor.execute(propose(processor, createOperation({
  operationId: 'demo-put-secondary',
  payload: {
    candidate: createCandidate('candidate-secondary', 'User prefers simple architecture.'),
    card: {
      id: 'demo-card-secondary',
      summary: 'User prefers simple architecture.',
      tags: ['simplicity']
    }
  }
})));

const mergeCards = executor.execute(propose(processor, createOperation({
  operationId: 'demo-merge',
  operationType: MEMORY_OPERATION_TYPES.merge,
  targetMemoryIds: ['demo-card-primary', 'demo-card-secondary'],
  mergePolicy: MEMORY_MERGE_POLICIES.targetWins,
  payload: {}
})));

const expirePrimary = executor.execute(propose(processor, createOperation({
  operationId: 'demo-expire-primary',
  operationType: MEMORY_OPERATION_TYPES.expire,
  targetMemoryIds: ['demo-card-primary'],
  payload: {
    expiration: {
      expiresAt: '2026-08-20T00:00:00.000Z',
      reason: 'demo-expiration'
    }
  }
})));

console.log(JSON.stringify({
  putPrimary,
  updatePrimary,
  mergeCards,
  expirePrimary,
  expiredCardStillPresent: runtime.getCard('demo-card-primary')
}, null, 2));
