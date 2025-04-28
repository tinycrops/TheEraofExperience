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
const experiential_agent_1 = require("./experiential_agent");
const dotenv = __importStar(require("dotenv-flow"));
const path = __importStar(require("path"));
// Load environment variables
dotenv.config({
    path: path.resolve(process.cwd()),
    node_env: process.env.NODE_ENV || 'development',
    default_node_env: 'development',
});
// Entry point for the application
async function main() {
    console.log('Starting The Era of Experience Agent...');
    console.log('Implementing concepts from the paper:');
    console.log('1. Learning from continuous streams of experience');
    console.log('2. Grounded actions and observations through tool use');
    console.log('3. Grounded rewards based on real-world outcomes');
    console.log('4. Planning using a world model trained from experience');
    try {
        // Run the experiential agent
        const session = await (0, experiential_agent_1.runExperientialAgent)();
        // Set up graceful shutdown
        process.on('SIGINT', async () => {
            console.log('Shutting down...');
            if (session && typeof session.close === 'function') {
                await session.close();
            }
            process.exit(0);
        });
        // Keep the process running for the simulated messages
        console.log('Agent is running. Press Ctrl+C to exit.');
        // For demo purposes, keep the process alive for a while
        // In a real application, this would run indefinitely
        console.log('This demo will automatically exit after 60 seconds');
        setTimeout(() => {
            console.log('Demo complete. Exiting...');
            process.exit(0);
        }, 60000);
    }
    catch (error) {
        console.error('Error running experiential agent:', error);
        process.exit(1);
    }
}
// Run the main function
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map