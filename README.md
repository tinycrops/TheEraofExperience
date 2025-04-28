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
3. Copy the `.env.example` file to `.env` and add your Gemini API key:
   ```
   cp .env.example .env
   # Edit .env to add your API key
   ```

### Running the Agent

Build and start the agent:

```
npm run build
npm start
```

For development with automatic reloading:

```
npm run dev
```

## Customization

### Reward Functions

To customize the reward calculation, edit `src/reward_functions.ts`. You can implement domain-specific reward functions based on your use case.

### Agent Configuration

Modify the system instructions and tools in `src/experiential_agent.ts` to customize the agent's behavior and capabilities.

### Learning Algorithm

The current implementation uses a simplified version of PPO (Proximal Policy Optimization). You can enhance this with a more sophisticated implementation in `src/rl_core.ts`.

## Next Steps

- Implement more sophisticated reward functions
- Add more tools for agent interaction
- Develop a proper PPO implementation
- Add multimodal capabilities
- Implement persistent storage for the replay buffer

## License

MIT 