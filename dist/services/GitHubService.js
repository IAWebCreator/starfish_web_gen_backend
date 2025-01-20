"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubService = void 0;
const rest_1 = require("@octokit/rest");
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
class GitHubService {
    constructor(authToken) {
        this.owner = 'IAWebCreator';
        this.octokit = new rest_1.Octokit({
            auth: authToken
        });
        this.tempDir = path_1.default.join(os_1.default.tmpdir(), 'web-generator');
    }
    async createRepository(name) {
        const { data } = await this.octokit.repos.createForAuthenticatedUser({
            name,
            private: false,
            auto_init: true
        });
        return data.html_url;
    }
    async uploadLogo(repoUrl, logoUrl) {
        // Create temp directory if it doesn't exist
        await promises_1.default.mkdir(this.tempDir, { recursive: true });
        const logoPath = path_1.default.join(this.tempDir, 'logo.png');
        try {
            // Download the logo
            const response = await (0, axios_1.default)({
                method: 'GET',
                url: logoUrl,
                responseType: 'arraybuffer'
            });
            // Save to temp file
            await promises_1.default.writeFile(logoPath, response.data);
            // Upload to GitHub
            const repoName = this.getRepoNameFromUrl(repoUrl);
            const content = await promises_1.default.readFile(logoPath, { encoding: 'base64' });
            await this.octokit.repos.createOrUpdateFileContents({
                owner: this.owner,
                repo: repoName,
                path: 'logo.png',
                message: 'Add logo image',
                content,
            });
            return logoPath;
        }
        catch (error) {
            console.error('Error uploading logo:', error);
            throw error;
        }
    }
    async pushHtmlFile(repoUrl, htmlContent) {
        const repoName = this.getRepoNameFromUrl(repoUrl);
        try {
            await this.octokit.repos.createOrUpdateFileContents({
                owner: this.owner,
                repo: repoName,
                path: 'index.html',
                message: 'Add generated website',
                content: Buffer.from(htmlContent).toString('base64'),
            });
        }
        catch (error) {
            console.error('Error pushing HTML file:', error);
            throw error;
        }
    }
    getRepoNameFromUrl(repoUrl) {
        const parts = repoUrl.split('/');
        return parts[parts.length - 1];
    }
    // Helper method to clean up temp files
    async cleanup() {
        try {
            await promises_1.default.rm(this.tempDir, { recursive: true, force: true });
        }
        catch (error) {
            console.error('Error cleaning up temp directory:', error);
        }
    }
}
exports.GitHubService = GitHubService;
