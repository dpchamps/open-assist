import type { AgentMessage } from '@mariozechner/pi-agent-core';
import type { Message, AssistantMessage, ToolResultMessage, TextContent } from '@mariozechner/pi-ai';

const FULL_FIDELITY_TURNS = 4;
const MAX_TURNS = 10;
const COMPACTED_RESULT_MAX_LENGTH = 150;

type Turn = AgentMessage[];

const isUserMessage = (msg: AgentMessage) =>
    (msg as Message).role === 'user';

const isAssistantMessage = (msg: AgentMessage): msg is AssistantMessage =>
    (msg as Message).role === 'assistant';

const isToolResultMessage = (msg: AgentMessage): msg is ToolResultMessage =>
    (msg as Message).role === 'toolResult';

const groupIntoTurns = (messages: AgentMessage[]): Turn[] => {
    const userIndices = messages
        .map((msg, i) => isUserMessage(msg) ? i : -1)
        .filter(i => i >= 0);

    if (userIndices.length === 0) return messages.length > 0 ? [messages] : [];

    const first = userIndices[0]!;
    const startIndices = first > 0 ? [0, ...userIndices] : userIndices;

    return startIndices.map((startIdx, i) => {
        const endIdx = i < startIndices.length - 1 ? startIndices[i + 1] : messages.length;
        return messages.slice(startIdx, endIdx);
    });
};

const stripThinking = (msg: AgentMessage): AgentMessage => {
    if (!isAssistantMessage(msg)) return msg;
    return {
        ...msg,
        content: msg.content.filter(c => c.type !== 'thinking'),
    };
};

const compactToolResult = (msg: ToolResultMessage): ToolResultMessage => {
    const textContent = msg.content
        .filter((c): c is TextContent => c.type === 'text')
        .map(c => c.text)
        .join(' ');

    const summary = textContent.length > COMPACTED_RESULT_MAX_LENGTH
        ? `${textContent.slice(0, COMPACTED_RESULT_MAX_LENGTH)}...`
        : textContent;

    return {
        ...msg,
        content: [{ type: 'text', text: `[${msg.toolName} result: ${summary}]` }],
    };
};

const compactTurn = (turn: Turn): Turn =>
    turn.map((msg) => {
        const stripped = stripThinking(msg);
        return isToolResultMessage(stripped) ? compactToolResult(stripped) : stripped;
    });

export const transformContext = async (messages: AgentMessage[]) => {
    const turns = groupIntoTurns(messages);

    if (turns.length <= FULL_FIDELITY_TURNS) {
        return turns.flatMap(turn => turn.map(stripThinking));
    }

    const keptTurns = turns.length > MAX_TURNS
        ? turns.slice(turns.length - MAX_TURNS)
        : turns;

    const splitPoint = keptTurns.length - FULL_FIDELITY_TURNS;
    const olderTurns = keptTurns.slice(0, splitPoint);
    const recentTurns = keptTurns.slice(splitPoint);

    return [
        ...olderTurns.flatMap(compactTurn),
        ...recentTurns.flatMap(turn => turn.map(stripThinking)),
    ];
};
