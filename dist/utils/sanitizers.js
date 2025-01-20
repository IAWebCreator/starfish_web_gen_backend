"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeSubdomain = sanitizeSubdomain;
exports.sanitizeRepoName = sanitizeRepoName;
function sanitizeSubdomain(input) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
        .substring(0, 63); // Ensure max length of 63 chars
}
function sanitizeRepoName(input) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-') // Replace invalid chars with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
        .substring(0, 100); // GitHub has a max length for repo names
}
