import { createClient, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { Octokit } from '@octokit/rest';
import axios from 'axios';
import { sanitizeSubdomain, sanitizeRepoName } from '../utils/sanitizers';
import { GeminiService } from './GeminiService';
import { GitHubService } from './GitHubService';
import { VercelService } from './VercelService';
import { Database } from '../types/database';
import { Logger } from '../utils/logger';
import { WebGeneratorError } from '../types/errors';

type WebBasicDataRow = Database['public']['Tables']['web_basic_data']['Row'];

export class WebGeneratorService {
  private supabase;
  private github;
  private gemini;
  private vercel;

  constructor() {
    // Initialize Supabase client
    this.supabase = createClient<Database>(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    );

    // Initialize services
    this.github = new GitHubService(process.env.GITHUB_CLIENT_SECRET!);
    this.gemini = new GeminiService(process.env.GEMINI_API_KEY!);
    this.vercel = new VercelService(process.env.VERCEL_API_KEY!);

    // Start listening for new entries
    this.initializeRealtimeSubscription();
  }

  private async initializeRealtimeSubscription() {
    const channel = this.supabase
      .channel('web_basic_data_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'web_basic_data',
        },
        async (payload: RealtimePostgresChangesPayload<WebBasicDataRow>) => {
          if (payload.eventType === 'INSERT') {
            await this.handleNewWebBasicData(payload.new as WebBasicDataRow);
          }
        }
      )
      .subscribe();
  }

  private async handleNewWebBasicData(data: WebBasicDataRow) {
    Logger.info('Starting web generation process', { tokenName: data.token_name });

    try {
      // 1. Generate repository name
      const repoName = sanitizeRepoName(`${data.token_name}_${data.id}`);
      Logger.info('Generated repository name', { repoName });

      // 2. Create GitHub repository
      const repoUrl = await this.github.createRepository(repoName);
      Logger.info('Created GitHub repository', { repoUrl });

      // 3. Generate and validate subdomain
      const baseSubdomain = sanitizeSubdomain(data.token_name);
      const subdomain = await this.ensureUniqueSubdomain(baseSubdomain, data.id);
      Logger.info('Generated subdomain', { subdomain });

      // 4. Create Vercel subdomain
      await this.vercel.createSubdomain(subdomain, data.id);
      Logger.info('Created Vercel subdomain');

      // 5. Download and upload logo
      const logoPath = await this.github.uploadLogo(repoUrl, data.logo_url);
      Logger.info('Uploaded logo to GitHub');

      // 6. Process with Gemini
      const descriptionLogoOutput = await this.processGeminiDescriptionLogo(logoPath, data.token_name);
      const negentropizedOutput = await this.processGeminiNegentropized(data.token_name, data.token_description);
      Logger.info('Processed initial Gemini prompts');

      // 7. Generate UI/UX style
      const uiuxStyle = await this.processGeminiUIUX(
        descriptionLogoOutput,
        negentropizedOutput,
        data
      );
      Logger.info('Generated UI/UX style');

      // 8. Generate final HTML
      const htmlContent = await this.generateFinalHtml(
        descriptionLogoOutput,
        negentropizedOutput,
        uiuxStyle,
        data
      );
      Logger.info('Generated final HTML');

      // 9. Push HTML to GitHub
      await this.github.pushHtmlFile(repoUrl, htmlContent);
      Logger.info('Pushed HTML to GitHub');

      // 10. Deploy to Vercel
      const deployedUrl = await this.vercel.deployRepository(repoUrl, subdomain);
      Logger.info('Deployed to Vercel', { deployedUrl });

      // 11. Save generated data
      await this.saveWebGeneratedData({
        wallet_address: data.wallet_address,
        github_repo_url: repoUrl,
        subdomain,
        web_generated_url: deployedUrl,
      });
      Logger.info('Saved web generated data');

      // 12. Cleanup
      await this.github.cleanup();
      Logger.info('Process completed successfully', { deployedUrl });

    } catch (error) {
      Logger.error('Error in web generation process', error);
      await this.handleError(error, data);
    }
  }

  private async processGeminiDescriptionLogo(
    logoPath: string,
    tokenName: string
  ): Promise<string> {
    try {
      return await this.gemini.processDescriptionLogo(logoPath, tokenName);
    } catch (error) {
      throw new WebGeneratorError(
        'Failed to process logo description',
        'gemini_description_logo',
        error
      );
    }
  }

  private async processGeminiNegentropized(
    tokenName: string,
    description: string
  ): Promise<string> {
    try {
      return await this.gemini.processNegentropized(tokenName, description);
    } catch (error) {
      throw new WebGeneratorError(
        'Failed to process negentropized description',
        'gemini_negentropized',
        error
      );
    }
  }

  private async processGeminiUIUX(
    descriptionLogoOutput: string,
    negentropizedOutput: string,
    data: WebBasicDataRow
  ): Promise<string> {
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
    } catch (error) {
      throw new WebGeneratorError(
        'Failed to generate UI/UX style',
        'gemini_uiux',
        error
      );
    }
  }

  private async generateFinalHtml(
    descriptionLogoOutput: string,
    negentropizedOutput: string,
    uiuxStyle: string,
    data: WebBasicDataRow
  ): Promise<string> {
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
    } catch (error) {
      throw new WebGeneratorError(
        'Failed to generate final HTML',
        'gemini_html',
        error
      );
    }
  }

  private async handleError(error: any, data: WebBasicDataRow): Promise<void> {
    // TODO: Implement error reporting to a monitoring service
    // TODO: Implement cleanup of any created resources
    // TODO: Implement retry logic for recoverable errors
    Logger.error('Web generation failed', {
      error,
      tokenName: data.token_name,
      tokenId: data.id,
    });
  }

  private async ensureUniqueSubdomain(
    baseSubdomain: string,
    id: number
  ): Promise<string> {
    const { data: existing } = await this.supabase
      .from('web_generated_data')
      .select('subdomain')
      .eq('subdomain', baseSubdomain)
      .single();

    return existing ? `${baseSubdomain}-${id}` : baseSubdomain;
  }

  private async saveWebGeneratedData(data: {
    wallet_address: string;
    github_repo_url: string;
    subdomain: string;
    web_generated_url: string;
  }) {
    await this.supabase.from('web_generated_data').insert([
      {
        ...data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  }
} 