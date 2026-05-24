function getCallsFromChoice(choice) {
  return choice?.delta?.tool_calls || choice?.message?.tool_calls || [];
}

// Future safe tool execution belongs after this parser, behind explicit allowlists.
// This module only recognizes provider tool-call shapes and never executes them.
export function normalizeToolCalls(providerId, data) {
  const choices = Array.isArray(data?.choices) ? data.choices : [];

  return choices.flatMap((choice) => getCallsFromChoice(choice).map((toolCall, index) => ({
    id: toolCall.id || `${providerId}-tool-${choice.index || 0}-${toolCall.index ?? index}`,
    provider: providerId,
    name: toolCall.function?.name || toolCall.name || '',
    arguments: toolCall.function?.arguments || toolCall.arguments || '',
    raw: toolCall
  })));
}
