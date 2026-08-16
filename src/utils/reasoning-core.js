function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createNormalizedError(code, message, category, stage) {
  return {
    code,
    message,
    category,
    stage
  };
}

function createEvent(phase, stage, detail = {}) {
  return {
    type: 'reasoning_core_event',
    phase,
    stage,
    ...cloneValue(detail)
  };
}

function createResult({
  status,
  stage,
  observationResult = null,
  verificationResult = null,
  reflectionResult = null,
  dispatchResults = [],
  completedProposalCount = 0,
  failedProposalIndex = null,
  failedProposalId = '',
  unexecutedProposals = [],
  events = [],
  error = '',
  normalizedError = null
}) {
  return {
    type: 'reasoning_core_result',
    status,
    stage,
    observationResult: cloneValue(observationResult),
    verificationResult: cloneValue(verificationResult),
    reflectionResult: cloneValue(reflectionResult),
    dispatchResults: cloneValue(dispatchResults),
    completedProposalCount,
    failedProposalIndex,
    failedProposalId,
    unexecutedProposals: cloneValue(unexecutedProposals),
    events: cloneValue(events),
    error,
    normalizedError: cloneValue(normalizedError)
  };
}

function createFailure(stage, message, results, events, {
  code = `reasoning_core_${stage}_failure`,
  category = 'runtime',
  normalizedError = null
} = {}) {
  const error = normalizedError || createNormalizedError(
    code,
    message,
    category,
    stage
  );
  const failureEvents = [
    ...events,
    createEvent(`${stage}_failed`, stage, { error: message })
  ];

  return createResult({
    ...results,
    status: 'error',
    stage,
    events: failureEvents,
    error: message,
    normalizedError: error
  });
}

function validateDependency(dependency, method, label) {
  return dependency && typeof dependency[method] === 'function'
    ? ''
    : `Reasoning Core requires an injected ${label}`;
}

function isAsyncResult(value) {
  return value && typeof value.then === 'function';
}

function createProposalReference(proposal, index) {
  return {
    index,
    proposalId: proposal.proposalId,
    proposalType: proposal.proposalType,
    operationId: proposal.proposedOperation.operationId
  };
}

export function createReasoningCore({
  observationRuntime,
  verificationRuntime,
  reflectionRuntime,
  dispatcher
} = {}) {
  function run({
    observation,
    verificationContext = {},
    reflectionContext = {}
  } = {}) {
    const events = [];
    const results = {
      observationResult: null,
      verificationResult: null,
      reflectionResult: null,
      dispatchResults: [],
      completedProposalCount: 0,
      failedProposalIndex: null,
      failedProposalId: '',
      unexecutedProposals: []
    };
    const dependencies = [
      [observationRuntime, 'record', 'Observation Runtime'],
      [verificationRuntime, 'verify', 'Verification Runtime'],
      [reflectionRuntime, 'reflect', 'Reflection Runtime'],
      [dispatcher, 'dispatch', 'Reflection Proposal Dispatcher']
    ];

    for (const [dependency, method, label] of dependencies) {
      const dependencyError = validateDependency(dependency, method, label);

      if (dependencyError) {
        return createFailure('configuration', dependencyError, results, events, {
          code: 'reasoning_core_dependency_unavailable',
          category: 'configuration'
        });
      }
    }

    let observationInput;
    let verificationInput;
    let reflectionInput;

    try {
      observationInput = cloneValue(observation);
      verificationInput = cloneValue(verificationContext);
      reflectionInput = cloneValue(reflectionContext);
    } catch {
      return createFailure(
        'observation',
        'Reasoning Core input could not be normalized',
        results,
        events,
        {
          code: 'reasoning_core_input_normalization_error',
          category: 'contract'
        }
      );
    }

    try {
      results.observationResult = observationRuntime.record(observationInput);
    } catch (error) {
      return createFailure(
        'observation',
        error instanceof Error ? error.message : 'Observation Runtime failed',
        results,
        events
      );
    }

    if (isAsyncResult(results.observationResult)) {
      return createFailure('observation', 'Asynchronous Observation Runtime is not supported', results, events);
    }

    if (results.observationResult?.status !== 'complete'
      || !results.observationResult.observation) {
      const message = results.observationResult?.error || 'Observation was rejected';

      return createFailure('observation', message, results, events, {
        normalizedError: results.observationResult?.normalizedError
      });
    }

    events.push(createEvent('observation_completed', 'observation', {
      observationId: results.observationResult.observationId
    }));

    try {
      results.verificationResult = verificationRuntime.verify(
        results.observationResult.observation,
        verificationInput
      );
    } catch (error) {
      return createFailure(
        'verification',
        error instanceof Error ? error.message : 'Verification Runtime failed',
        results,
        events
      );
    }

    if (isAsyncResult(results.verificationResult)) {
      return createFailure('verification', 'Asynchronous Verification Runtime is not supported', results, events);
    }

    if (results.verificationResult?.status !== 'complete'
      || !results.verificationResult.verification) {
      const message = results.verificationResult?.error || 'Verification failed';

      return createFailure('verification', message, results, events, {
        normalizedError: results.verificationResult?.normalizedError
      });
    }

    events.push(createEvent('verification_completed', 'verification', {
      verificationId: results.verificationResult.verificationId
    }));

    try {
      results.reflectionResult = reflectionRuntime.reflect(
        [results.verificationResult.verification],
        reflectionInput
      );
    } catch (error) {
      return createFailure(
        'reflection',
        error instanceof Error ? error.message : 'Reflection Runtime failed',
        results,
        events
      );
    }

    if (isAsyncResult(results.reflectionResult)) {
      return createFailure('reflection', 'Asynchronous Reflection Runtime is not supported', results, events);
    }

    if (results.reflectionResult?.status !== 'complete'
      || !Array.isArray(results.reflectionResult.proposals)
      || !Array.isArray(results.reflectionResult.rejections)) {
      const message = results.reflectionResult?.error || 'Reflection failed';

      return createFailure('reflection', message, results, events, {
        normalizedError: results.reflectionResult?.normalizedError
      });
    }

    events.push(createEvent('reflection_completed', 'reflection', {
      proposalCount: results.reflectionResult.proposals.length,
      rejectionCount: results.reflectionResult.rejections.length
    }));

    results.reflectionResult.rejections.forEach((rejection) => {
      events.push(createEvent('proposal_rejected', 'reflection', {
        proposalId: rejection.proposalId,
        index: rejection.index,
        error: rejection.error
      }));
    });

    for (let proposalIndex = 0;
      proposalIndex < results.reflectionResult.proposals.length;
      proposalIndex += 1) {
      const proposal = results.reflectionResult.proposals[proposalIndex];
      let dispatchResult;

      try {
        dispatchResult = dispatcher.dispatch(proposal);
      } catch (error) {
        dispatchResult = {
          type: 'reflection_proposal_dispatch_result',
          status: 'error',
          success: false,
          proposalId: proposal.proposalId,
          proposalType: proposal.proposalType,
          error: error instanceof Error ? error.message : 'Dispatcher failed',
          normalizedError: createNormalizedError(
            'reasoning_core_dispatcher_failure',
            error instanceof Error ? error.message : 'Dispatcher failed',
            'dispatcher',
            'dispatch'
          )
        };
      }

      if (isAsyncResult(dispatchResult)) {
        dispatchResult = {
          type: 'reflection_proposal_dispatch_result',
          status: 'error',
          success: false,
          proposalId: proposal.proposalId,
          proposalType: proposal.proposalType,
          error: 'Asynchronous Dispatcher is not supported',
          normalizedError: createNormalizedError(
            'reasoning_core_async_dispatcher_unsupported',
            'Asynchronous Dispatcher is not supported',
            'dispatcher',
            'dispatch'
          )
        };
      }

      results.dispatchResults.push(dispatchResult);
      events.push(createEvent(
        dispatchResult?.status === 'complete'
          ? 'proposal_dispatched'
          : 'proposal_dispatch_failed',
        'dispatch',
        {
          proposalIndex,
          proposalId: proposal.proposalId,
          operationId: proposal.proposedOperation.operationId,
          error: dispatchResult?.error || ''
        }
      ));

      if (dispatchResult?.status !== 'complete' || dispatchResult?.success === false) {
        results.failedProposalIndex = proposalIndex;
        results.failedProposalId = proposal.proposalId;
        results.unexecutedProposals = results.reflectionResult.proposals
          .slice(proposalIndex + 1)
          .map((unexecutedProposal, offset) => createProposalReference(
            unexecutedProposal,
            proposalIndex + offset + 1
          ));

        return createResult({
          ...results,
          status: results.completedProposalCount > 0 ? 'partial' : 'error',
          stage: 'dispatch',
          events,
          error: dispatchResult?.error || 'Proposal dispatch failed',
          normalizedError: dispatchResult?.normalizedError || createNormalizedError(
            'reasoning_core_dispatch_failure',
            dispatchResult?.error || 'Proposal dispatch failed',
            'dispatcher',
            'dispatch'
          )
        });
      }

      results.completedProposalCount += 1;
    }

    if (results.reflectionResult.proposals.length === 0
      && results.reflectionResult.rejections.length > 0) {
      const rejection = results.reflectionResult.rejections[0];

      return createResult({
        ...results,
        status: 'rejected',
        stage: 'reflection',
        events,
        error: rejection.error,
        normalizedError: rejection.normalizedError
      });
    }

    return createResult({
      ...results,
      status: 'complete',
      stage: 'complete',
      events,
      error: '',
      normalizedError: null
    });
  }

  return {
    run
  };
}
