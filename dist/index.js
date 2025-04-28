"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const experiential_agent_1 = require("./experiential_agent");
// Entry point for the application
async function main() {
    console.log('Starting The Era of Experience Agent...');
    try {
        // Run the experiential agent
        const session = await (0, experiential_agent_1.runExperientialAgent)();
        // Set up graceful shutdown
        process.on('SIGINT', async () => {
            console.log('Shutting down...');
            await session.close();
            process.exit(0);
        });
        // Keep the process running for the simulated messages
        console.log('Agent is running. Press Ctrl+C to exit.');
        // For demo purposes, automatically exit after 10 seconds
        setTimeout(() => {
            console.log('Demo complete. Exiting...');
            process.exit(0);
        }, 10000);
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
