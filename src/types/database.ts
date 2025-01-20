export interface Database {
  public: {
    Tables: {
      web_basic_data: {
        Row: {
          id: number;
          wallet_address: string;
          token_name: string;
          token_ticker: string;
          token_description: string;
          token_contract_number: string;
          twitter_url: string | null;
          telegram_url: string | null;
          youtube_url: string | null;
          tiktok_url: string | null;
          logo_url: string;
          transaction_id: string;
          created_at: string;
          updated_at: string;
        };
      };
      web_generated_data: {
        Row: {
          id: number;
          wallet_address: string;
          github_repo_url: string;
          subdomain: string;
          web_generated_url: string;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
} 