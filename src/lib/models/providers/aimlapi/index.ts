import { UIConfigField } from '@/lib/config/types';
import { getConfiguredModelProviderById } from '@/lib/config/serverRegistry';
import { Model, ModelList, ProviderMetadata } from '../../types';
import BaseModelProvider from '../../base/provider';
import BaseLLM from '../../base/llm';
import BaseEmbedding from '../../base/embedding';
import OpenAILLM from '../openai/openaiLLM';

interface AIMLAPIConfig {
  apiKey: string;
}

const AIMLAPI_BASE_URL = 'https://api.aimlapi.com/v1';

const defaultChatModels: Model[] = [
  { key: 'gpt-4o', name: 'GPT-4o' },
  { key: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { key: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { key: 'o1', name: 'o1' },
  { key: 'o3-mini', name: 'o3 Mini' },
  { key: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
  { key: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
  { key: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  { key: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { key: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  {
    key: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    name: 'Llama 3.3 70B Instruct Turbo',
  },
  { key: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1' },
  { key: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3' },
  {
    key: 'mistralai/Mistral-7B-Instruct-v0.3',
    name: 'Mistral 7B Instruct',
  },
  {
    key: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    name: 'Mixtral 8x7B Instruct',
  },
  {
    key: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
    name: 'Qwen 2.5 72B Instruct Turbo',
  },
];

const providerConfigFields: UIConfigField[] = [
  {
    type: 'password',
    name: 'API Key',
    key: 'apiKey',
    description: 'Your AIML API key',
    required: true,
    placeholder: 'AIML API Key',
    env: 'AIMLAPI_API_KEY',
    scope: 'server',
  },
];

class AIMLAPIProvider extends BaseModelProvider<AIMLAPIConfig> {
  constructor(id: string, name: string, config: AIMLAPIConfig) {
    super(id, name, config);
  }

  async getDefaultModels(): Promise<ModelList> {
    return {
      chat: defaultChatModels,
      embedding: [],
    };
  }

  async getModelList(): Promise<ModelList> {
    const defaultModels = await this.getDefaultModels();
    const configProvider = getConfiguredModelProviderById(this.id)!;

    return {
      embedding: [
        ...defaultModels.embedding,
        ...configProvider.embeddingModels,
      ],
      chat: [...defaultModels.chat, ...configProvider.chatModels],
    };
  }

  async loadChatModel(key: string): Promise<BaseLLM<any>> {
    const modelList = await this.getModelList();
    const exists = modelList.chat.find((m) => m.key === key);

    if (!exists) {
      throw new Error(
        'Error Loading AIML API Chat Model. Invalid Model Selected',
      );
    }

    return new OpenAILLM({
      apiKey: this.config.apiKey,
      model: key,
      baseURL: AIMLAPI_BASE_URL,
    });
  }

  async loadEmbeddingModel(_key: string): Promise<BaseEmbedding<any>> {
    throw new Error(
      'AIML API does not support embedding models via this provider',
    );
  }

  static parseAndValidate(raw: any): AIMLAPIConfig {
    if (!raw || typeof raw !== 'object')
      throw new Error('Invalid config provided. Expected object');
    if (!raw.apiKey)
      throw new Error('Invalid config provided. API key must be provided');

    return {
      apiKey: String(raw.apiKey),
    };
  }

  static getProviderConfigFields(): UIConfigField[] {
    return providerConfigFields;
  }

  static getProviderMetadata(): ProviderMetadata {
    return {
      key: 'aimlapi',
      name: 'AIML API',
    };
  }
}

export default AIMLAPIProvider;
