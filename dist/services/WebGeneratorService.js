"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebGeneratorService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const sanitizers_1 = require("../utils/sanitizers");
const GeminiService_1 = require("./GeminiService");
const GitHubService_1 = require("./GitHubService");
const VercelService_1 = require("./VercelService");
const logger_1 = require("../utils/logger");
const errors_1 = require("../types/errors");
class WebGeneratorService {
    constructor() {
        // Initialize Supabase client
        this.supabase = (0, supabase_js_1.createClient)(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
        // Initialize services
        this.github = new GitHubService_1.GitHubService(process.env.GITHUB_CLIENT_SECRET);
        this.gemini = new GeminiService_1.GeminiService(process.env.GEMINI_API_KEY);
        this.vercel = new VercelService_1.VercelService(process.env.VERCEL_API_KEY);
        // Start listening for new entries
        this.initializeRealtimeSubscription();
    }
    async initializeRealtimeSubscription() {
        const channel = this.supabase
            .channel('web_basic_data_changes')
            .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'web_basic_data',
        }, async (payload) => {
            if (payload.eventType === 'INSERT') {
                await this.handleNewWebBasicData(payload.new);
            }
        })
            .subscribe();
    }
    async handleNewWebBasicData(data) {
        logger_1.Logger.info('Starting web generation process', { tokenName: data.token_name });
        try {
            // 1. Generate repository name
            const repoName = (0, sanitizers_1.sanitizeRepoName)(`${data.token_name}_${data.id}`);
            logger_1.Logger.info('Generated repository name', { repoName });
            // 2. Create GitHub repository
            const repoUrl = await this.github.createRepository(repoName);
            logger_1.Logger.info('Created GitHub repository', { repoUrl });
            // 3. Generate and validate subdomain
            const baseSubdomain = (0, sanitizers_1.sanitizeSubdomain)(data.token_name);
            const subdomain = await this.ensureUniqueSubdomain(baseSubdomain, data.id);
            logger_1.Logger.info('Generated subdomain', { subdomain });
            // 4. Create Vercel subdomain
            await this.vercel.createSubdomain(subdomain);
            logger_1.Logger.info('Created Vercel subdomain');
            // 5. Download and upload logo
            const logoPath = await this.github.uploadLogo(repoUrl, data.logo_url);
            logger_1.Logger.info('Uploaded logo to GitHub');
            // 6. Process with Gemini
            const descriptionLogoOutput = await this.processGeminiDescriptionLogo(logoPath, data.token_name);
            const negentropizedOutput = await this.processGeminiNegentropized(data.token_name, data.token_description);
            logger_1.Logger.info('Processed initial Gemini prompts');
            // 7. Generate UI/UX style
            const uiuxStyle = await this.processGeminiUIUX(descriptionLogoOutput, negentropizedOutput, data);
            logger_1.Logger.info('Generated UI/UX style');
            // 8. Generate final HTML
            const htmlContent = await this.generateFinalHtml(descriptionLogoOutput, negentropizedOutput, uiuxStyle, data);
            logger_1.Logger.info('Generated final HTML');
            // 9. Push HTML to GitHub
            await this.github.pushHtmlFile(repoUrl, htmlContent);
            logger_1.Logger.info('Pushed HTML to GitHub');
            // 10. Deploy to Vercel
            const deployedUrl = await this.vercel.deployRepository(repoUrl, subdomain);
            logger_1.Logger.info('Deployed to Vercel', { deployedUrl });
            // 11. Save generated data
            await this.saveWebGeneratedData({
                wallet_address: data.wallet_address,
                github_repo_url: repoUrl,
                subdomain,
                web_generated_url: deployedUrl,
            });
            logger_1.Logger.info('Saved web generated data');
            // 12. Cleanup
            await this.github.cleanup();
            logger_1.Logger.info('Process completed successfully', { deployedUrl });
        }
        catch (error) {
            logger_1.Logger.error('Error in web generation process', error);
            await this.handleError(error, data);
        }
    }
    async processGeminiDescriptionLogo(logoPath, tokenName) {
        try {
            return await this.gemini.processDescriptionLogo(logoPath, tokenName);
        }
        catch (error) {
            throw new errors_1.WebGeneratorError('Failed to process logo description', 'gemini_description_logo', error);
        }
    }
    async processGeminiNegentropized(tokenName, description) {
        try {
            return await this.gemini.processNegentropized(tokenName, description);
        }
        catch (error) {
            throw new errors_1.WebGeneratorError('Failed to process negentropized description', 'gemini_negentropized', error);
        }
    }
    async processGeminiUIUX(descriptionLogoOutput, negentropizedOutput, data) {
        try {
            return await this.gemini.processUIUXStyle({
                descriptionLogoOutput,
                negentropizedOutput,
                name: data.token_name,
                description: data.token_description,
                ticker: data.token_ticker,
                contractNumber: data.token_contract_number,
                urls: {
                    twitter: data.twitter_url,
                    telegram: data.telegram_url,
                    youtube: data.youtube_url,
                    tiktok: data.tiktok_url,
                },
            });
        }
        catch (error) {
            throw new errors_1.WebGeneratorError('Failed to generate UI/UX style', 'gemini_uiux', error);
        }
    }
    async generateFinalHtml(descriptionLogoOutput, negentropizedOutput, uiuxStyle, data) {
        try {
            return await this.gemini.generateHTML({
                descriptionLogoOutput,
                negentropizedOutput,
                uiuxStyle,
                tokenData: {
                    name: data.token_name,
                    description: data.token_description,
                    ticker: data.token_ticker,
                    contractAddress: data.token_contract_number,
                    urls: {
                        twitter: data.twitter_url,
                        telegram: data.telegram_url,
                        youtube: data.youtube_url,
                        tiktok: data.tiktok_url,
                    },
                },
            });
        }
        catch (error) {
            throw new errors_1.WebGeneratorError('Failed to generate final HTML', 'gemini_html', error);
        }
    }
    async handleError(error, data) {
        // TODO: Implement error reporting to a monitoring service
        // TODO: Implement cleanup of any created resources
        // TODO: Implement retry logic for recoverable errors
        logger_1.Logger.error('Web generation failed', {
            error,
            tokenName: data.token_name,
            tokenId: data.id,
        });
    }
    async ensureUniqueSubdomain(baseSubdomain, id) {
        const { data: existing } = await this.supabase
            .from('web_generated_data')
            .select('subdomain')
            .eq('subdomain', baseSubdomain)
            .single();
        return existing ? `${baseSubdomain}-${id}` : baseSubdomain;
    }
    async saveWebGeneratedData(data) {
        await this.supabase.from('web_generated_data').insert([
            {
                ...data,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
        ]);
    }
}
exports.WebGeneratorService = WebGeneratorService;
