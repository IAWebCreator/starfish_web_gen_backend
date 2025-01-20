"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const promises_1 = __importDefault(require("fs/promises"));
class GeminiService {
    constructor(apiKey) {
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
        this.visionModel = this.genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
    }
    async processDescriptionLogo(logoPath, tokenName) {
        const imageData = await promises_1.default.readFile(logoPath);
        const prompt = await promises_1.default.readFile('prompts/description_logo_prompt.text', 'utf-8');
        const result = await this.visionModel.generateContent([
            prompt.replace('{negentropized_name_orthopsychestyle}', tokenName),
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: imageData.toString('base64')
                }
            }
        ]);
        const response = await result.response;
        return response.text();
    }
    async processNegentropized(tokenName, description) {
        const prompt = await promises_1.default.readFile('prompts/negentropized_prompt.txt', 'utf-8');
        const result = await this.model.generateContent(prompt.replace('{description}', description).replace('{name}', tokenName));
        const response = await result.response;
        return response.text();
    }
    async processUIUXStyle(data) {
        const prompt = await promises_1.default.readFile('prompts/UI_UX_style_prompt.text', 'utf-8');
        const result = await this.model.generateContent(prompt
            .replace('{description_logo_prompt_output}', data.descriptionLogoOutput)
            .replace('{negentropized_prompt_output}', data.negentropizedOutput)
            .replace('{name}', data.name)
            .replace('{description}', data.description));
        const response = await result.response;
        return response.text();
    }
    async generateHTML(data) {
        const prompt = await promises_1.default.readFile('prompts/html_creator_prompt.text', 'utf-8');
        const result = await this.model.generateContent(prompt
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
            .replace('{tik tok url}', data.tokenData.urls.tiktok || ''));
        const response = await result.response;
        return response.text();
    }
}
exports.GeminiService = GeminiService;
