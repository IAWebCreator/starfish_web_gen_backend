"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VercelService = void 0;
const axios_1 = __importDefault(require("axios"));
class VercelService {
    constructor(apiKey) {
        this.baseUrl = 'https://api.vercel.com';
        this.teamId = 'team_XXXXX'; // Replace with your Vercel team ID if needed
        this.apiKey = apiKey;
    }
    async createSubdomain(subdomain) {
        try {
            await axios_1.default.post(`${this.baseUrl}/v1/domains`, {
                name: `${subdomain}.starfishlabs.fun`,
            }, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            });
        }
        catch (error) {
            console.error('Error creating subdomain:', error);
            throw error;
        }
    }
    async deployRepository(repoUrl, subdomain) {
        try {
            // Create deployment
            const deploymentResponse = await axios_1.default.post(`${this.baseUrl}/v13/deployments`, {
                name: subdomain,
                gitSource: {
                    type: 'github',
                    repo: repoUrl.replace('https://github.com/', ''),
                    ref: 'main'
                },
            }, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            });
            const { id: deploymentId } = deploymentResponse.data;
            // Configure custom domain
            await axios_1.default.post(`${this.baseUrl}/v9/projects/${subdomain}/domains`, {
                name: `${subdomain}.starfishlabs.fun`,
            }, {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            });
            // Wait for deployment to be ready
            await this.waitForDeployment(deploymentId);
            return `https://${subdomain}.starfishlabs.fun`;
        }
        catch (error) {
            console.error('Error deploying repository:', error);
            throw error;
        }
    }
    async waitForDeployment(deploymentId) {
        const maxAttempts = 30;
        const delayMs = 2000;
        let attempts = 0;
        while (attempts < maxAttempts) {
            try {
                const response = await axios_1.default.get(`${this.baseUrl}/v13/deployments/${deploymentId}`, {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                });
                const { readyState } = response.data;
                if (readyState === 'READY') {
                    return;
                }
                if (readyState === 'ERROR') {
                    throw new Error('Deployment failed');
                }
                await new Promise(resolve => setTimeout(resolve, delayMs));
                attempts++;
            }
            catch (error) {
                console.error('Error checking deployment status:', error);
                throw error;
            }
        }
        throw new Error('Deployment timed out');
    }
}
exports.VercelService = VercelService;
