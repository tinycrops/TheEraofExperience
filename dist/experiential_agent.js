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
exports.runExperientialAgent = runExperientialAgent;
const generative_ai_1 = require("@google/generative-ai");
const rl_core_1 = require("./rl_core");
const reward_functions_1 = require("./reward_functions");
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
// Helper function to extract observation from message
function extractObservation(msg) {
    // Extract relevant information from the message
    // This would be customized based on your specific use case
    const content = msg.content || {};
    return {
        message: content,
        timestamp: new Date().toISOString()
    };
}
// Main function to run the experiential agent
async function runExperientialAgent() {
    // Check for API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
    }
    // Set up Gemini API client
    const ai = new generative_ai_1.GoogleGenerativeAI(apiKey);
    console.log('Initializing experiential agent...');
    // Create a mock session for testing since the live API isn't fully implemented yet
    const mockSession = {
        sendClientContent: (content) => {
            console.log('Sent content to client:', JSON.stringify(content).substring(0, 200) + '...');
        },
        close: async () => {
            console.log('Session closed');
        },
        onmessage: (msg) => { },
        onerror: (error) => { },
        onclose: () => { }
    };
    // Set up replay buffer and PPO agent
    const buffer = new rl_core_1.ReplayBuffer(1e6);
    const agent = new rl_core_1.PPO({ modelName: 'gemini-1.5-pro', sdk: ai });
    // For testing, we'll simulate some messages
    const simulateMessage = (content) => {
        if (mockSession.onmessage) {
            mockSession.onmessage({ content });
        }
    };
    // Set up message handler
    mockSession.onmessage = async (msg) => {
        try {
            console.log('Received message:', JSON.stringify(msg).substring(0, 200) + '...');
            // Extract observation from message
            const obs = extractObservation(msg);
            // Get action from agent
            const action = await agent.act(obs);
            // Execute action by sending it to the session
            console.log('Sending action:', JSON.stringify(action).substring(0, 200) + '...');
            mockSession.sendClientContent(action);
            // Calculate reward
            const reward = await (0, reward_functions_1.calcReward)(obs, action);
            console.log('Calculated reward:', reward);
            // Add transition to replay buffer
            buffer.add({ obs, action, reward });
            // Periodically update the agent
            if (buffer.size() % 512 === 0) {
                console.log('Learning from batch...');
                const batch = buffer.sample(2048);
                await agent.learn(batch);
            }
        }
        catch (error) {
            console.error('Error in message handler:', error);
        }
    };
    // Simulate some initial messages for testing
    setTimeout(() => {
        simulateMessage({ text: "Hello, I need help with a task." });
    }, 1000);
    setTimeout(() => {
        simulateMessage({ text: "Can you search for information about machine learning?" });
    }, 2000);
    // Return the mock session for external management
    return mockSession;
}
