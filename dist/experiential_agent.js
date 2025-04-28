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
exports.PlanningToolSchema = exports.EnvironmentActionSchema = exports.WebSearchToolSchema = void 0;
exports.persistExperience = persistExperience;
exports.handleLiveMessage = handleLiveMessage;
exports.runExperientialAgent = runExperientialAgent;
const genai_1 = require("@google/genai");
const rl_core_1 = require("./rl_core");
const reward_functions_1 = require("./reward_functions");
const dotenv = __importStar(require("dotenv-flow"));
const fs_1 = require("fs");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const memory_1 = require("./memory");
const world_model_1 = require("./world_model");
// Load environment variables - explicitly include .env.local
dotenv.config({
    path: path.resolve(process.cwd()),
    node_env: process.env.NODE_ENV || 'development',
    default_node_env: 'development',
});
// Log API key (first few characters only for security)
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey) {
    console.log(`API Key loaded: ${apiKey.substring(0, 5)}...`);
}
else {
    console.warn('API Key not found in environment variables!');
}
// Global session registry
const sessions = new Map();
// Helper function to extract observation from message
function extractObservation(msg, sessionId) {
    if (!msg.serverContent) {
        return {
            message: { text: '' },
            timestamp: new Date().toISOString(),
            sessionId
        };
    }
    // Extract relevant information from the message
    return {
        message: msg.serverContent,
        timestamp: new Date().toISOString(),
        sessionId
    };
}
// Ensure data directory exists
function ensureDataDirectory() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const dir = path.join(process.cwd(), 'data', dateStr);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, 'stream.ndjson');
}
// Function to save experience to NDJSON file
async function persistExperience(experience) {
    const filepath = ensureDataDirectory();
    const serialized = JSON.stringify(experience) + '\n';
    await fs_1.promises.appendFile(filepath, serialized);
}
// Token counter for managing context size
async function tokenCost(ai, contents) {
    try {
        // With the new SDK, the token counting is not directly available
        // We'll use a simple estimation method as fallback
        return JSON.stringify(contents).length / 4;
    }
    catch (error) {
        console.error('Error counting tokens:', error);
        // Fallback estimate if the API call fails
        return JSON.stringify(contents).length / 4;
    }
}
// Retry helper for API calls
async function withRetry(fn, tries = 3) {
    for (let i = 0; i < tries; i++) {
        try {
            return await fn();
        }
        catch (e) {
            if (i >= tries - 1)
                throw e;
            const waitTime = 2 ** i * 200;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    throw new Error('All retries failed');
}
// Define the specific schema for the web search tool
exports.WebSearchToolSchema = {
    name: 'webSearch',
    description: 'Performs a web search using Google Custom Search API',
    parameters: {
        type: genai_1.Type.OBJECT,
        properties: {
            query: {
                type: genai_1.Type.STRING,
                description: 'The search query string',
            },
        },
        required: ['query'],
    },
};
// Define schema for environmental action tools
exports.EnvironmentActionSchema = {
    name: 'environmentAction',
    description: 'Performs an action in the environment, such as controlling a device or accessing a database',
    parameters: {
        type: genai_1.Type.OBJECT,
        properties: {
            action: {
                type: genai_1.Type.STRING,
                description: 'The action to perform',
            },
            parameters: {
                type: genai_1.Type.OBJECT,
                description: 'Parameters for the action',
            },
        },
        required: ['action'],
    },
};
// Define schema for planning
exports.PlanningToolSchema = {
    name: 'planSequence',
    description: 'Plans a sequence of actions to achieve a goal',
    parameters: {
        type: genai_1.Type.OBJECT,
        properties: {
            goal: {
                type: genai_1.Type.STRING,
                description: 'The goal to achieve',
            },
            steps: {
                type: genai_1.Type.INTEGER,
                description: 'Number of steps to plan ahead',
            },
        },
        required: ['goal'],
    },
};
// --- End Task 3.1 ---
// Get or create session state
function getSessionState(sessionId, worldModel) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
            sessionId,
            startTime: Date.now(),
            interactionCount: 0,
            lastInteractionTime: Date.now(),
            plannedActions: [],
            worldModel
        });
    }
    return sessions.get(sessionId);
}
// Exported handler for testability
async function handleLiveMessage({ msg, session, buffer, agent, sessionId, persistExperience, vectorMemory }) {
    console.log('DEBUG: Entered onmessage callback', msg);
    try {
        console.log('Received message');
        // Get session state
        const sessionState = getSessionState(sessionId, undefined);
        // Update session metrics
        sessionState.interactionCount++;
        sessionState.lastInteractionTime = Date.now();
        const sessionDuration = Date.now() - sessionState.startTime;
        // --- Task 3.3: Refined Tool Use Implementation ---
        if (msg.serverContent && msg.serverContent.functionCall) {
            const { functionCall } = msg.serverContent;
            console.log(`DEBUG: Detected function call: ${functionCall.name}`);
            if (functionCall.name === 'webSearch') {
                const args = functionCall.args || {};
                const query = args.query;
                if (!query) {
                    console.error('Web search called without a query argument.');
                    // Send back an error message to the model
                    await session.sendClientContent({
                        parts: [{ functionResponse: {
                                    name: 'webSearch',
                                    response: { error: 'Missing query argument' }
                                } }]
                    });
                    return; // Stop processing this message
                }
                // Load necessary API Keys and CSE ID from environment
                const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
                const CSE_ID = process.env.GOOGLE_CSE_ID;
                if (!GOOGLE_API_KEY || !CSE_ID) {
                    console.error('Missing GOOGLE_API_KEY or GOOGLE_CSE_ID for web search.');
                    await session.sendClientContent({
                        parts: [{ functionResponse: {
                                    name: 'webSearch',
                                    response: { error: 'Server configuration error: Missing API key or CSE ID' }
                                } }]
                    });
                    return;
                }
                const encodedQuery = encodeURIComponent(query);
                const url = `https://www.googleapis.com/customsearch/v1?q=${encodedQuery}&key=${GOOGLE_API_KEY}&cx=${CSE_ID}`;
                console.log(`DEBUG: Calling Google Custom Search API: ${url.replace(GOOGLE_API_KEY, '[REDACTED]')}`);
                const start = Date.now();
                let fetchResult;
                let resultJson;
                let webSearchSuccess = false;
                let responseToSend;
                try {
                    fetchResult = await fetch(url);
                    webSearchSuccess = fetchResult.ok;
                    resultJson = await fetchResult.json();
                    if (!webSearchSuccess) {
                        console.error(`Web search API error: ${fetchResult.status}`, resultJson);
                        responseToSend = { error: `API Error ${fetchResult.status}`, details: resultJson?.error?.message };
                    }
                    else {
                        // Extract relevant results (e.g., top 3 snippets)
                        const items = resultJson?.items || [];
                        const snippets = items.slice(0, 3).map((item) => ({
                            title: item.title,
                            link: item.link,
                            snippet: item.snippet
                        }));
                        console.log(`DEBUG: Web search returned ${snippets.length} snippets.`);
                        responseToSend = { results: snippets };
                    }
                }
                catch (fetchError) {
                    console.error('Error during web search fetch:', fetchError);
                    webSearchSuccess = false;
                    responseToSend = { error: 'Network error during web search', details: fetchError.message };
                }
                const latencyMs = Date.now() - start;
                console.log(`DEBUG: Web search completed in ${latencyMs}ms. Success: ${webSearchSuccess}`);
                // --- Task 3.4: Stream result back using functionResponse --- 
                await session.sendClientContent({
                    parts: [{ functionResponse: {
                                name: 'webSearch',
                                response: responseToSend
                            } }]
                });
                // --- End Task 3.4 ---
                // Record experience AFTER sending response back
                const obs = extractObservation(msg, sessionId); // Observation is the model's request
                // Action should be Content type
                const action = {
                    parts: [{ functionResponse: { name: 'webSearch', response: responseToSend } }]
                };
                const metrics = {
                    latencyMs,
                    webSearchSuccess,
                    sessionDuration,
                    userInteractions: sessionState.interactionCount
                };
                const rewardResult = await (0, reward_functions_1.calcReward)(obs, action, metrics);
                const experience = {
                    obs,
                    action,
                    reward: rewardResult,
                    done: false,
                    sessionId
                };
                // Save experience to buffer and disk
                buffer.add(experience);
                await persistExperience(experience);
                // Update world model if available
                if (sessionState.worldModel) {
                    await sessionState.worldModel.update(experience);
                }
                return;
            }
            else if (functionCall.name === 'planSequence') {
                const args = functionCall.args || {};
                const goal = args.goal;
                const steps = args.steps || 3;
                if (!goal) {
                    console.error('Planning called without a goal.');
                    await session.sendClientContent({
                        parts: [{ functionResponse: {
                                    name: 'planSequence',
                                    response: { error: 'Missing goal argument' }
                                } }]
                    });
                    return;
                }
                // Create world model if it doesn't exist
                if (!sessionState.worldModel && vectorMemory) {
                    // Create a GoogleGenAI instance
                    const genAI = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
                    sessionState.worldModel = new world_model_1.WorldModel(genAI, vectorMemory);
                }
                // Generate possible actions
                // In a real system, these would be dynamically generated based on capabilities
                const possibleActions = [
                    { parts: [{ text: "I'll search for information about " + goal }] },
                    { parts: [{ text: "Let me ask follow-up questions about " + goal }] },
                    { functionCall: { name: 'webSearch', args: { query: goal } } },
                    { parts: [{ text: "I'll break down this problem step by step..." }] }
                ];
                let plannedActions = [];
                if (sessionState.worldModel) {
                    // Get current observation
                    const obs = extractObservation(msg, sessionId);
                    // Plan sequence of actions using world model
                    plannedActions = await sessionState.worldModel.planActions(obs, possibleActions, steps);
                    // Store in session state
                    sessionState.plannedActions = plannedActions;
                }
                // Respond with the plan
                await session.sendClientContent({
                    parts: [{ functionResponse: {
                                name: 'planSequence',
                                response: {
                                    plan: plannedActions,
                                    goal: goal,
                                    steps: plannedActions.length
                                }
                            } }]
                });
                return;
            }
            else if (functionCall.name === 'environmentAction') {
                const args = functionCall.args || {};
                const action = args.action;
                const parameters = args.parameters || {};
                // This would connect to real external systems in a production environment
                // For now, we'll simulate successful actions
                const actionResult = {
                    success: true,
                    actionPerformed: action,
                    result: `Successfully performed ${action}`,
                    metrics: {
                        // These would be real metrics in production
                        taskCompleted: true
                    }
                };
                // Send response
                await session.sendClientContent({
                    parts: [{ functionResponse: {
                                name: 'environmentAction',
                                response: actionResult
                            } }]
                });
                return;
            }
        }
        // --- End Task 3.3 & 3.4 ---
        // Check if we have planned actions from previous planning
        if (sessionState.plannedActions && sessionState.plannedActions.length > 0) {
            const nextAction = sessionState.plannedActions.shift();
            if (nextAction) {
                console.log('DEBUG: Using planned action from world model');
                // Execute the planned action
                if (nextAction.functionCall) {
                    // If it's a function call, we need to handle it properly
                    console.log('DEBUG: Executing planned function call', nextAction.functionCall);
                    // This would need to recursively handle the function call
                    // For simplicity, let's just send the function call back to the model
                    await session.sendClientContent(nextAction);
                }
                else {
                    // Otherwise, it's a text response
                    console.log('DEBUG: Executing planned text response');
                    await session.sendClientContent(nextAction);
                }
                // Record experience
                const obs = extractObservation(msg, sessionId);
                const metrics = {
                    sessionDuration,
                    userInteractions: sessionState.interactionCount,
                    taskCompleted: true // Assume planned actions are successful
                };
                const rewardResult = await (0, reward_functions_1.calcReward)(obs, nextAction, metrics);
                const experience = {
                    obs,
                    action: nextAction,
                    reward: rewardResult,
                    done: false,
                    sessionId
                };
                buffer.add(experience);
                await persistExperience(experience);
                // Update world model
                if (sessionState.worldModel) {
                    await sessionState.worldModel.update(experience);
                }
                return;
            }
        }
        // For normal messages from the user, defer to the agent
        if (msg.serverContent) {
            // Process user message
            const obs = extractObservation(msg, sessionId);
            // Learn from past experiences before responding
            if (buffer.size() >= 10) {
                await agent.learn(buffer.sample(10));
            }
            // Get action from agent
            const action = await agent.act(obs);
            // Send response back to user
            await session.sendClientContent(action);
            // Calculate reward metrics
            const metrics = {
                sessionDuration,
                userInteractions: sessionState.interactionCount
            };
            // Calculate reward
            const rewardResult = await (0, reward_functions_1.calcReward)(obs, action, metrics);
            // Create experience record
            const experience = {
                obs,
                action,
                reward: rewardResult,
                done: false,
                sessionId
            };
            // Store experience
            buffer.add(experience);
            await persistExperience(experience);
            // Update world model
            if (sessionState.worldModel) {
                await sessionState.worldModel.update(experience);
            }
        }
    }
    catch (error) {
        console.error('Error handling message:', error);
        try {
            await session.sendClientContent({
                parts: [{ text: "I encountered an error. Please try again later." }]
            });
        }
        catch (e) {
            console.error('Error sending error response:', e);
        }
    }
}
async function runExperientialAgent() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('No API key provided. Set GEMINI_API_KEY in your environment variables.');
    }
    const genAI = new genai_1.GoogleGenAI({ apiKey });
    // Initialize agent
    const buffer = new rl_core_1.ReplayBuffer(100);
    const agent = new rl_core_1.PPO({
        modelName: 'gemini-2.0-flash',
        genAI,
        batchSize: 5
    });
    // Initialize vector memory for long-term storage
    // We use separate DB files for different strategies
    const vectorMemory = new memory_1.VectorMemory(apiKey, 'data/experience_memory.db');
    // Initialize world model
    const worldModel = new world_model_1.WorldModel(genAI, vectorMemory);
    // Simulate Gemini Live API setup
    const sessionId = `session-${Date.now()}`;
    // Initialize session state
    getSessionState(sessionId, worldModel);
    // Create a simulated "session" - in a real application, this would be a WebSocket
    // or similar streaming connection
    const session = {
        sendClientContent: async (content) => {
            console.log('Sending to client:', JSON.stringify(content).substring(0, 200) + '...');
            // Simulate client response in 1 second
            setTimeout(() => {
                // For demo purposes, you could add more prompts here
                // to simulate continued conversation
            }, 1000);
        },
        close: () => {
            console.log('Session closed');
        }
    };
    // Load system prompt
    const systemPrompt = loadPromptFromFile('prompts/system.txt') || `You are an AI assistant that learns from experience. Help the user.`;
    // Simulated initial message to kickstart the conversation
    const initialMessage = {
        serverContent: "Hello! I'm interested in learning about quantum computing. Can you help me understand the basic principles?"
    };
    // Process the simulated message
    await handleLiveMessage({
        msg: initialMessage,
        session,
        buffer,
        agent,
        sessionId,
        persistExperience,
        vectorMemory
    });
    return session;
}
function loadPromptFromFile(filePath) {
    try {
        const absolutePath = path.resolve(process.cwd(), filePath);
        if (fs.existsSync(absolutePath)) {
            return fs.readFileSync(absolutePath, 'utf8');
        }
        return null;
    }
    catch (error) {
        console.error(`Error loading prompt from ${filePath}:`, error);
        return null;
    }
}
// Allow running directly
if (require.main === module) {
    runExperientialAgent();
}
//# sourceMappingURL=experiential_agent.js.map