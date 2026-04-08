import OpenAI from 'openai';
import OpenAILLM from '../openai/openaiLLM';

type OpenRouterConfig = {
  apiKey: string;
  model: string;
  siteUrl?: string;
  siteName?: string;
};

class OpenRouterLLM extends OpenAILLM {
  constructor(protected config: OpenRouterConfig) {
    super({
      apiKey: config.apiKey,
      model: config.model,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    this.openAIClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer':
          config.siteUrl ||
          'https://github.com/371-Minds/Perplexica371',
        'X-Title': config.siteName || 'Perplexica371',
      },
    });
  }
}

export default OpenRouterLLM;
