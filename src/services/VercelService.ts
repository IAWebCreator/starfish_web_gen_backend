import axios from 'axios';
import fs from 'fs/promises';

export class VercelService {
  private apiKey: string;
  private baseUrl = 'https://api.vercel.com';
  private teamId: string;
  private rootDomain = 'starfishlabs.fun';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.teamId = process.env.VERCEL_TEAM_ID || '';
  }

  async createSubdomain(subdomain: string, id?: number): Promise<void> {
    try {
      // First ensure root domain exists
      await this.ensureRootDomain();

      // Create project first
      const projectResponse = await axios.post(
        `${this.baseUrl}/v9/projects`,
        {
          name: subdomain,
          framework: null
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            teamId: this.teamId,
          },
        }
      );

      const projectId = projectResponse.data.id;

      // Add domain to the project
      await axios.post(
        `${this.baseUrl}/v9/projects/${projectId}/domains`,
        {
          name: `${subdomain}.${this.rootDomain}`
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            teamId: this.teamId,
          },
        }
      );

      // Wait for domain to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error: any) {
      console.error('Vercel API Error:', error.response?.data || error);
      throw error;
    }
  }

  private async createProject(name: string) {
    return await axios.post(
      `${this.baseUrl}/v9/projects`,
      { name },
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        params: {
          teamId: this.teamId,
        },
      }
    );
  }

  private async addDomainToProject(projectId: string, subdomain: string) {
    try {
      await axios.post(
        `${this.baseUrl}/v9/projects/${projectId}/domains`,
        {
          name: `${subdomain}.${this.rootDomain}`,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            teamId: this.teamId,
          },
        }
      );
    } catch (error: any) {
      if (error.response?.status === 409) {
        console.error('Domain conflict, will try alternative name');
        throw error; // Let the parent handle the retry
      }
      throw error;
    }
  }

  private async ensureRootDomain(): Promise<void> {
    try {
      // Check if root domain exists
      const response = await axios.get(
        `${this.baseUrl}/v9/domains/${this.rootDomain}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          params: {
            teamId: this.teamId,
          },
        }
      );

      if (!response.data || response.data.error) {
        // Add root domain if it doesn't exist
        await axios.post(
          `${this.baseUrl}/v8/domains`,
          {
            name: this.rootDomain,
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            params: {
              teamId: this.teamId,
            },
          }
        );

        // Wait for root domain to be ready
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Domain doesn't exist, add it
        await axios.post(
          `${this.baseUrl}/v8/domains`,
          {
            name: this.rootDomain,
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            params: {
              teamId: this.teamId,
            },
          }
        );
        // Wait for root domain to be ready
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        throw error;
      }
    }
  }

  async deployRepository(repoUrl: string, subdomain: string): Promise<string> {
    try {
      // Extract owner and repo from GitHub URL
      const [owner, repo] = repoUrl.split('/').slice(-2);
      
      // Create deployment from GitHub
      const deploymentResponse = await axios.post(
        `${this.baseUrl}/v13/deployments`,
        {
          name: subdomain,
          gitSource: {
            type: 'github',
            org: owner, // GitHub organization/owner
            repo: repo, // Repository name
            ref: 'main' // Branch name
          },
          target: 'production',
          framework: null
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          params: {
            teamId: this.teamId,
          },
        }
      );

      const { id: deploymentId } = deploymentResponse.data;

      // Wait for deployment to be ready
      await this.waitForDeployment(deploymentId);

      return `https://${subdomain}.${this.rootDomain}`;
    } catch (error) {
      console.error('Error deploying repository:', error);
      throw error;
    }
  }

  private async getGitHubRepoId(repoUrl: string): Promise<string> {
    // Extract owner and repo from URL
    const [owner, repo] = repoUrl.split('/').slice(-2);
    
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers: {
            Authorization: `token ${process.env.GITHUB_CLIENT_SECRET}`,
          }
        }
      );
      
      return response.data.id.toString();
    } catch (error) {
      console.error('Error getting GitHub repo ID:', error);
      throw error;
    }
  }

  private async waitForDeployment(deploymentId: string): Promise<void> {
    const maxAttempts = 30;
    const delayMs = 2000;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/v13/deployments/${deploymentId}`,
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
            params: {
              teamId: this.teamId,
            },
          }
        );

        const { readyState } = response.data;
        if (readyState === 'READY') {
          return;
        }

        if (readyState === 'ERROR') {
          throw new Error('Deployment failed');
        }

        await new Promise(resolve => setTimeout(resolve, delayMs));
        attempts++;
      } catch (error) {
        console.error('Error checking deployment status:', error);
        throw error;
      }
    }

    throw new Error('Deployment timed out');
  }

  private async getFileContent(repoUrl: string, filename: string): Promise<string> {
    // Get raw content from GitHub
    const rawUrl = repoUrl
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob', '');
    
    const response = await axios.get(`${rawUrl}/main/${filename}`);
    return response.data;
  }
} 