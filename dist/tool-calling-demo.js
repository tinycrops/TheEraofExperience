"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const genai_1 = require("@google/genai");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables from .env.local file
dotenv_1.default.config({ path: '.env.local' });
// Initialize the Gemini API with your API key
const genAI = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
// Define tool schemas
const getWeatherTool = {
    name: "get_weather",
    description: "Get the current weather in a given location",
    parameters: {
        type: genai_1.Type.OBJECT,
        properties: {
            location: {
                type: genai_1.Type.STRING,
                description: "The city and state, e.g. San Francisco, CA"
            },
            unit: {
                type: genai_1.Type.STRING,
                enum: ["celsius", "fahrenheit"],
                description: "The unit of temperature"
            }
        },
        required: ["location"]
    }
};
const searchNewsTool = {
    name: "search_news",
    description: "Search for news articles on a given topic",
    parameters: {
        type: genai_1.Type.OBJECT,
        properties: {
            topic: {
                type: genai_1.Type.STRING,
                description: "The topic to search for news about"
            },
            limit: {
                type: genai_1.Type.INTEGER,
                description: "The maximum number of results to return"
            }
        },
        required: ["topic"]
    }
};
// Tool implementation functions
async function getWeather(location, unit = "celsius") {
    // This would normally call a weather API
    console.log(`[TOOL] Getting weather for ${location} in ${unit}`);
    const weatherData = {
        location,
        temperature: unit === "celsius" ? 22 : 72,
        condition: "Sunny",
        humidity: 45,
        wind: "5 mph"
    };
    return weatherData;
}
async function searchNews(topic, limit = 3) {
    // This would normally call a news API
    console.log(`[TOOL] Searching for ${limit} news articles about "${topic}"`);
    return [
        {
            title: `Latest developments in ${topic}`,
            source: "Example News",
            date: new Date().toISOString().split('T')[0],
            snippet: `This is a simulated news article about ${topic}.`
        },
        {
            title: `${topic} trends and analysis`,
            source: "Tech Insider",
            date: new Date().toISOString().split('T')[0],
            snippet: `Experts weigh in on the future of ${topic}.`
        },
        {
            title: `Why ${topic} matters in today's world`,
            source: "Global Perspective",
            date: new Date().toISOString().split('T')[0],
            snippet: `Understanding the impact of ${topic} on various industries.`
        }
    ].slice(0, limit);
}
async function runDemo() {
    try {
        // Access the models property
        const geminiModel = genAI.models;
        console.log('Creating chat with Gemini using tool definitions...');
        // Define a user query that should trigger tool use
        const query = "What's the weather like in New York and are there any recent news about climate change?";
        console.log(`\nUser query: ${query}`);
        // Generate content with tool definitions
        const result = await geminiModel.generateContent({
            model: 'gemini-2.0-flash',
            contents: query,
            config: {
                temperature: 0.7,
                tools: [
                    {
                        functionDeclarations: [getWeatherTool, searchNewsTool]
                    }
                ],
                toolConfig: {
                    functionCallingConfig: {
                        mode: genai_1.FunctionCallingConfigMode.AUTO
                    }
                }
            }
        });
        // Check for function calls in the response
        const functionCalls = result.functionCalls || [];
        if (functionCalls.length > 0) {
            console.log('\nTool calls detected:');
            // Process each tool call
            const toolResults = await Promise.all(functionCalls.map(async (functionCall) => {
                console.log(`\nCalling tool: ${functionCall.name}`);
                console.log(`Parameters: ${JSON.stringify(functionCall.args, null, 2)}`);
                // Execute the appropriate tool
                let result;
                if (functionCall.name === 'get_weather') {
                    const { location, unit = 'celsius' } = functionCall.args;
                    result = await getWeather(location, unit);
                }
                else if (functionCall.name === 'search_news') {
                    const { topic, limit = 3 } = functionCall.args;
                    result = await searchNews(topic, limit);
                }
                return {
                    name: functionCall.name,
                    result
                };
            }));
            // Filter out any null results and type them correctly
            const validResults = toolResults.filter((result) => result !== null && result.result !== undefined);
            if (validResults.length > 0) {
                console.log('\nSending tool results back to Gemini:');
                console.log(JSON.stringify(validResults, null, 2));
                // Create summary text from the tool results
                let weatherResult;
                let newsResults = [];
                // Extract typed results
                for (const result of validResults) {
                    if (result.name === 'get_weather') {
                        weatherResult = result.result;
                    }
                    else if (result.name === 'search_news') {
                        newsResults = result.result;
                    }
                }
                let summaryText = "Based on the results:\n\n";
                if (weatherResult) {
                    summaryText += `Weather in ${weatherResult.location}: ${weatherResult.temperature}°${weatherResult.temperature === 22 ? 'C' : 'F'}, ${weatherResult.condition}. `;
                    summaryText += `Humidity: ${weatherResult.humidity}%, Wind: ${weatherResult.wind}\n\n`;
                }
                if (newsResults.length > 0) {
                    summaryText += "Recent news about climate change:\n";
                    for (const article of newsResults) {
                        summaryText += `- ${article.title} (${article.source}): ${article.snippet}\n`;
                    }
                }
                console.log('\nFinal summary:');
                console.log(summaryText);
            }
        }
        else {
            // If no tool calls, just show the response
            console.log('\nResponse (no tool calls used):');
            console.log(result.text);
        }
    }
    catch (error) {
        console.error('Error during demo:', error);
    }
}
// Run the demo
runDemo();
//# sourceMappingURL=tool-calling-demo.js.map