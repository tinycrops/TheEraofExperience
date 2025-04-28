"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const genai_1 = require("@google/genai");
const dotenv = __importStar(require("dotenv-flow"));
const path = __importStar(require("path"));
// Load environment variables - explicitly include .env.local
dotenv.config({
    path: path.resolve(process.cwd()),
    node_env: process.env.NODE_ENV || 'development',
    default_node_env: 'development',
});
async function main() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
    }
    console.log('Initializing Gemini API...');
    console.log(`API Key loaded: ${apiKey.substring(0, 5)}...`);
    const genAI = new genai_1.GoogleGenAI({ apiKey });
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    console.log(`Using model: ${modelName}`);
    try {
        console.log('Sending a test query...');
        const result = await genAI.models.generateContent({
            model: modelName,
            contents: [{
                    role: 'user',
                    parts: [{ text: 'What is reinforcement learning?' }]
                }]
        });
        console.log('\nResponse:');
        console.log(result.text);
        console.log('\nTest completed successfully!');
    }
    catch (error) {
        console.error('Error testing Gemini API:', error);
    }
}
main().catch(console.error);
