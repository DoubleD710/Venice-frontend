import {
  normalizeReflectionProposal,
  validateReflectionProposal
} from './reflection-contracts.js';
import { REFLECTION_PROPOSAL_TYPES } from './reflection-types.js';

const PROPOSAL_DOMAINS = {
  [REFLECTION_PROPOSAL_TYPES.memoryPut]: 'memory',
  [REFLECTION_PROPOSAL_TYPES.memoryUpdate]: 'memory',
  [REFLECTION_PROPOSAL_TYPES.memoryMerge]: 'memory',
  [REFLECTION_PROPOSAL_TYPES.memoryExpire]: 'memory',
  [REFLECTION_PROPOSAL_TYPES.relationshipLink]: 'relationship',
  [REFLECTION_PROPOSAL_TYPES.relationshipUnlink]: 'relationship',
  [REFLECTION_PROPOSAL_TYPES.relationshipStrengthen]: 'relationship',
  [REFLECTION_PROPOSAL_TYPES.relationshipWeaken]: 'relationship'
};

function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createNormalizedError(code, message, category) {
  return {
    code,
    message,
    category
  };
}

function createDispatchResult(proposal, domain, executorResult) {
  return {
    type: 'reflection_proposal_dispatch_result',
    status: 'complete',
    success: true,
    proposalId: proposal.proposalId,
    proposalType: proposal.proposalType,
    domain,
    operationId: proposal.proposedOperation.operationId,
    idempotencyKey: proposal.proposedOperation.idempotencyKey || '',
    provenance: cloneValue(proposal.provenance),
    executorResult: cloneValue(executorResult),
    error: '',
    normalizedError: null
  };
}

function createDispatchError(message, proposal = null, {
  domain = '',
  executorResult = null,
  code = 'reflection_dispatch_error',
  category = 'dispatch'
} = {}) {
  return {
    type: 'reflection_proposal_dispatch_result',
    status: 'error',
    success: false,
    proposalId: proposal?.proposalId || '',
    proposalType: proposal?.proposalType || '',
    domain,
    operationId: proposal?.proposedOperation?.operationId || '',
    idempotencyKey: proposal?.proposedOperation?.idempotencyKey || '',
    provenance: proposal?.provenance ? cloneValue(proposal.provenance) : {},
    executorResult,
    error: message,
    normalizedError: createNormalizedError(code, message, category)
  };
}

function isExecutorFailure(result) {
  return result?.success === false
    || result?.status === 'error'
    || result?.executionStatus === 'error';
}

function getExecutorError(result) {
  if (typeof result?.error === 'string' && result.error) {
    return result.error;
  }

  if (typeof result?.normalizedError?.message === 'string' && result.normalizedError.message) {
    return result.normalizedError.message;
  }

  return 'Domain executor rejected the operation';
}

export function createReflectionProposalDispatcher({
  memoryExecutor,
  relationshipExecutor
} = {}) {
  function dispatch(proposalInput) {
    let proposal;

    try {
      proposal = normalizeReflectionProposal(proposalInput);
    } catch {
      return createDispatchError('Reflection proposal could not be normalized', null, {
        code: 'reflection_dispatch_normalization_error',
        category: 'contract'
      });
    }

    const validation = validateReflectionProposal(proposal);

    if (!validation.ok) {
      return createDispatchError(validation.errors[0], proposal, {
        code: 'reflection_dispatch_invalid_proposal',
        category: 'contract'
      });
    }

    const domain = PROPOSAL_DOMAINS[proposal.proposalType];
    const executor = domain === 'memory' ? memoryExecutor : relationshipExecutor;

    if (!domain) {
      return createDispatchError('Reflection proposal type is unsupported', proposal, {
        code: 'reflection_dispatch_unsupported_proposal',
        category: 'routing'
      });
    }

    if (!executor || typeof executor.execute !== 'function') {
      return createDispatchError(`Reflection dispatcher requires a ${domain} executor`, proposal, {
        domain,
        code: 'reflection_dispatch_executor_unavailable',
        category: 'precondition'
      });
    }

    let executorResult;

    try {
      executorResult = executor.execute(proposal.proposedOperation);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Domain executor threw an unknown error';

      return createDispatchError(message, proposal, {
        domain,
        code: 'reflection_dispatch_executor_failure',
        category: 'executor'
      });
    }

    if (executorResult && typeof executorResult.then === 'function') {
      return createDispatchError('Asynchronous domain executors are not supported in v0.1', proposal, {
        domain,
        code: 'reflection_dispatch_async_executor_unsupported',
        category: 'executor'
      });
    }

    let normalizedExecutorResult;

    try {
      normalizedExecutorResult = cloneValue(executorResult);
    } catch {
      return createDispatchError('Domain executor returned an unsupported result', proposal, {
        domain,
        code: 'reflection_dispatch_invalid_executor_result',
        category: 'executor'
      });
    }

    if (isExecutorFailure(normalizedExecutorResult)) {
      return createDispatchError(getExecutorError(normalizedExecutorResult), proposal, {
        domain,
        executorResult: normalizedExecutorResult,
        code: 'reflection_dispatch_executor_failure',
        category: 'executor'
      });
    }

    return createDispatchResult(proposal, domain, normalizedExecutorResult);
  }

  return {
    dispatch
  };
}
