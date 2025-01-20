import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private visionModel: GenerativeModel;
  private sonnetApiKey: string;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      generationConfig: {
        temperature: 0.4,
        topP: 0.8,
        topK: 40,
      }
    });
    this.visionModel = this.model;
    this.sonnetApiKey = process.env.SONNET_API_KEY || '';
  }

  // Step 1: Process logo with description_logo_prompt
  async processDescriptionLogo(logoPath: string, tokenName: string): Promise<string> {
    try {
      const imageData = await fs.readFile(logoPath);
      const prompt = await fs.readFile('prompts/description_logo_prompt.text', 'utf-8');

      const formattedPrompt = prompt.replace('{negentropized_name_orthopsychestyle}', tokenName);

      const result = await this.visionModel.generateContent([
        { text: formattedPrompt },
        {
          inlineData: {
            mimeType: this.getMimeType(logoPath),
            data: imageData.toString('base64')
          }
        }
      ]);

      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error in processDescriptionLogo:', error);
      throw error;
    }
  }

  // Step 2: Process token info with negentropized_prompt
  async processNegentropized(tokenName: string, description: string): Promise<string> {
    try {
      const prompt = await fs.readFile('prompts/negentropized_prompt.txt', 'utf-8');
      
      const formattedPrompt = prompt
        .replace('{name}', tokenName)
        .replace('{description}', description);

      const result = await this.model.generateContent(formattedPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error in processNegentropized:', error);
      throw error;
    }
  }

  // Step 3: Process UI/UX style with all previous outputs
  async processUIUXStyle(data: {
    descriptionLogoOutput: string;
    negentropizedOutput: string;
    name: string;
    description: string;
    ticker: string;
    contractNumber: string;
    urls: {
      twitter?: string | null;
      telegram?: string | null;
      youtube?: string | null;
      tiktok?: string | null;
    };
  }): Promise<string> {
    try {
      const prompt = await fs.readFile('prompts/UI_UX_style_prompt.text', 'utf-8');
      
      const formattedPrompt = prompt
        .replace('{description_logo_prompt_output}', data.descriptionLogoOutput)
        .replace('{negentropized_prompt_output}', data.negentropizedOutput)
        .replace('{name}', data.name)
        .replace('{description}', data.description)
        .replace('{ticker}', data.ticker)
        .replace('{token_contract}', data.contractNumber)
        .replace('{twitter_url}', data.urls.twitter || '')
        .replace('{telegram_url}', data.urls.telegram || '')
        .replace('{youtube_url}', data.urls.youtube || '')
        .replace('{tiktok_url}', data.urls.tiktok || '');

      const result = await this.model.generateContent(formattedPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error in processUIUXStyle:', error);
      throw error;
    }
  }

  // Step 4: Generate final HTML using Claude/Anthropic
  async generateHTML(data: {
    descriptionLogoOutput: string;
    negentropizedOutput: string;
    uiuxStyle: string;
    tokenData: {
      name: string;
      description: string;
      ticker: string;
      contractAddress: string;
      urls: {
        twitter?: string | null;
        telegram?: string | null;
        youtube?: string | null;
        tiktok?: string | null;
      };
    };
  }): Promise<string> {
    try {
      const prompt = await fs.readFile('prompts/html_creator_prompt.text', 'utf-8');
      
      const formattedPrompt = prompt
        .replace('{description_logo_prompt_output}', data.descriptionLogoOutput)
        .replace('{negentropized_prompt_output}', data.negentropizedOutput)
        .replace('{UI_UX_style_prompt_output}', data.uiuxStyle)
        .replace('{name}', data.tokenData.name)
        .replace('{description}', data.tokenData.description)
        .replace('{ticker}', data.tokenData.ticker)
        .replace('{contract_adress}', data.tokenData.contractAddress)
        .replace('{twitter url}', data.tokenData.urls.twitter || '')
        .replace('{Telegram url}', data.tokenData.urls.telegram || '')
        .replace('{YouTube url}', data.tokenData.urls.youtube || '')
        .replace('{tik tok url}', data.tokenData.urls.tiktok || '')
        .replace('{Instagram url}', '');

      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-sonnet-20240229',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: formattedPrompt
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.sonnetApiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      return response.data.content[0].text;
    } catch (error) {
      console.error('Error in generateHTML:', error);
      throw error;
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.png': return 'image/png';
      case '.jpg':
      case '.jpeg': return 'image/jpeg';
      case '.gif': return 'image/gif';
      case '.webp': return 'image/webp';
      default: return 'image/png';
    }
  }
} 