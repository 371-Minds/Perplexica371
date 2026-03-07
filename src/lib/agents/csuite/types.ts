import BaseLLM from '@/lib/models/base/llm';
import { ChatTurnMessage } from '@/lib/types';

export type CSuiteAgentConfig = {
  llm: BaseLLM<any>;
  systemInstructions: string;
};

export type CSuiteAgentInput = {
  chatHistory: ChatTurnMessage[];
  followUp: string;
  config: CSuiteAgentConfig;
  chatId: string;
  messageId: string;
};

export type SubAgentReport = {
  role: 'cfo' | 'cto' | 'clo';
  label: string;
  content: string;
};
