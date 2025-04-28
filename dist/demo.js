"use strict";
/**
 * Demo script to showcase the experiential agent with sample interactions.
 * This demonstrates how to use the experiential agent with the Gemini API.
 */
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
const experiential_agent_1 = require("./experiential_agent");
const readline = __importStar(require("readline"));
const dotenv = __importStar(require("dotenv-flow"));
const path = __importStar(require("path"));
const reward_functions_1 = require("./reward_functions");
// Load environment variables - explicitly include .env.local
dotenv.config({
    path: path.resolve(process.cwd()),
    node_env: process.env.NODE_ENV || 'development',
    default_node_env: 'development',
});
// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
// Function to ask a question and get a response
function askQuestion(query) {
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            resolve(answer);
        });
    });
}
async function runDemo() {
    console.log('---- The Era of Experience Agent Demo ----');
    console.log('This demo shows how an agent can learn from experiences over time.');
    console.log('The agent will respond to your messages and learn from the interactions.');
    console.log('Type "exit" or press Ctrl+C to end the demo.');
    console.log('-----------------------------------------');
    try {
        // Initialize the experiential agent
        console.log('Initializing experiential agent...');
        const session = await (0, experiential_agent_1.runExperientialAgent)();
        // Since we don't get a sessionId from the session object anymore, generate our own
        const demoSessionId = `demo-${Date.now()}`;
        console.log(`Using demo session ID: ${demoSessionId}`);
        // Set up a graceful shutdown handler
        process.on('SIGINT', async () => {
            console.log('\nShutting down...');
            if (session) {
                await session.close();
            }
            rl.close();
            process.exit(0);
        });
        // Sample queries to demonstrate the agent
        const sampleQueries = [
            "What is reinforcement learning?",
            "How does an agent learn from experience?",
            "What are the key components of the Era of Experience approach?",
            "How can I implement a reward function?",
            "What's the difference between RL and supervised learning?"
        ];
        console.log('\nSuggested queries:');
        sampleQueries.forEach((query, index) => {
            console.log(`${index + 1}. ${query}`);
        });
        // Main interaction loop
        let interacting = true;
        while (interacting) {
            console.log('\n');
            const userInput = await askQuestion('You: ');
            if (userInput.toLowerCase() === 'exit') {
                interacting = false;
                continue;
            }
            // Send the user message to the session
            if (session && typeof session.sendClientContent === 'function') {
                await session.sendClientContent({ text: userInput });
            }
            else {
                console.log('Warning: Cannot send message - session or sendClientContent is not available');
            }
            // AUTOMATED: Generate random feedback rating (1-5) and persist
            const rating = Math.floor(Math.random() * 5) + 1;
            console.log(`(Automated) Feedback: ${rating}/5`);
            if (demoSessionId) {
                (0, reward_functions_1.persistUserRating)(demoSessionId, rating);
            }
        }
        // Close the session and readline
        console.log('Thank you for using the Experience Era agent!');
        if (session && typeof session.close === 'function') {
            await session.close();
        }
        rl.close();
    }
    catch (error) {
        console.error('Error in demo:', error);
        rl.close();
        process.exit(1);
    }
}
// Run the demo
runDemo().catch(console.error);
//# sourceMappingURL=demo.js.map