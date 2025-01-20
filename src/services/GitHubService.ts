import { Octokit } from '@octokit/rest';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class GitHubService {
  private octokit: Octokit;
  private owner = 'IAWebCreator';
  private tempDir: string;

  constructor(authToken: string) {
    this.octokit = new Octokit({
      auth: authToken
    });
    this.tempDir = path.join(os.tmpdir(), 'web-generator');
  }

  async createRepository(name: string): Promise<string> {
    const { data } = await this.octokit.repos.createForAuthenticatedUser({
      name,
      private: false,
      auto_init: true
    });

    return data.html_url;
  }

  async uploadLogo(repoUrl: string, logoUrl: string): Promise<string> {
    // Create temp directory if it doesn't exist
    await fs.mkdir(this.tempDir, { recursive: true });
    const logoPath = path.join(this.tempDir, 'logo.png');

    try {
      // Download the logo
      const response = await axios({
        method: 'GET',
        url: logoUrl,
        responseType: 'arraybuffer'
      });

      // Save to temp file
      await fs.writeFile(logoPath, response.data);

      // Upload to GitHub
      const repoName = this.getRepoNameFromUrl(repoUrl);
      const content = await fs.readFile(logoPath, { encoding: 'base64' });

      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: repoName,
        path: 'logo.png',
        message: 'Add logo image',
        content,
      });

      return logoPath;
    } catch (error) {
      console.error('Error uploading logo:', error);
      throw error;
    }
  }

  async pushHtmlFile(repoUrl: string, htmlContent: string): Promise<void> {
    const repoName = this.getRepoNameFromUrl(repoUrl);

    try {
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: repoName,
        path: 'index.html',
        message: 'Add generated website',
        content: Buffer.from(htmlContent).toString('base64'),
      });
    } catch (error) {
      console.error('Error pushing HTML file:', error);
      throw error;
    }
  }

  private getRepoNameFromUrl(repoUrl: string): string {
    const parts = repoUrl.split('/');
    return parts[parts.length - 1];
  }

  // Helper method to clean up temp files
  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up temp directory:', error);
    }
  }
} 