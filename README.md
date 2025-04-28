# The Era of Experience: Experiential AI Agent

This project implements an experiential AI agent based on the concepts from "The Era of Experience" paper by David Silver and Richard S. Sutton. The agent learns from continuous interactions with its environment using reinforcement learning techniques.

## Key Concepts

- **Streams of Experience**: The agent maintains a continuous session with the environment, enabling long-term learning and adaptation.
- **Autonomous Actions**: The agent can take actions in its environment through function calling and API interactions.
- **Grounded Observations**: The agent receives real observations from its environment rather than just synthetic data.
- **Grounded Rewards**: The agent's learning is driven by real-world signals rather than solely human feedback.
- **Planning and Reasoning**: The agent uses its model to reason about the consequences of its actions.

## Project Structure

- `src/experiential_agent.ts` - The core experiential agent implementation
- `src/rl_core.ts` - Reinforcement learning components (ReplayBuffer, PPO)
- `src/reward_functions.ts` - Functions for calculating rewards
- `src/index.ts` - Main entry point
- `src/demo.ts` - Interactive demo script for hands-on testing
- `tests/` - Unit tests for the implementation

## Features

- 💬 Live interactions using Gemini's real-time API
- 📊 Multi-component reward system (user feedback, relevance, exploration)
- 🧠 Experience-based learning using the Proximal Policy Optimization (PPO) algorithm
- 📝 Automatic persistence of experiences to NDJSON files
- 🔄 Automatic advantage calculation with GAE(λ)
- 🛠️ Action generation and evaluation with a systematic approach

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Gemini API key (from Google AI Studio)

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   cd TheEraofExperience
   npm install
   ```
3. Copy the `.env.example` file to `.env.local` and add your Gemini API key:
   ```
   cp .env.example .env.local
   # Edit .env.local to add:
   # GEMINI_API_KEY=your_api_key_here
   # GEMINI_MODEL=gemini-2.0-flash
   ```

### Running the Agent

Build and run the interactive demo:
```
npm run build
npx ts-node src/demo.ts
```

For development with automatic reloading:
```
npm run dev
```

Run the tests:
```
npm test
```

## Customization

### Reward Functions

To customize the reward calculation, edit `src/reward_functions.ts`. The current implementation includes:

- **User Feedback Reward**: Based on user's explicit rating or inferred from response patterns
- **Relevance Reward**: Uses a second Gemini model to score the relevance of responses to queries
- **Exploration Reward**: Encourages diverse behavior by rewarding new states and actions

### Agent Configuration

Modify the system instructions and tools in `src/experiential_agent.ts` to customize the agent's behavior and capabilities.

### Learning Algorithm

The implementation includes a proper PPO algorithm with:
- Advantage estimation using Generalized Advantage Estimation (GAE)
- Policy updates based on high-reward experiences
- In-context learning to improve model responses

## Data Collection

The agent automatically saves all experiences to daily NDJSON files in the `data/` directory. This provides:

- A growing dataset for offline training
- A record of all interactions and rewards
- Material for analyzing agent behavior over time

## Next Steps

- Implement full tool calling capabilities
- Add multimodal observation support
- Develop a proper web interface for interactions
- Implement distributed experience collection
- Add reinforcement learning from human feedback (RLHF)

## License

MIT 