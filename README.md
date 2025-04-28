# The Era of Experience

This project demonstrates the key principles from ["The Era of Experience" paper by David Silver and Richard S. Sutton](The%20Era%20of%20Experience%20Paper%20(1).txt). It shows how AI agents can learn from their own experiences in an ongoing stream over time, moving beyond the limitations of human-derived data.

## Key Principles

The implementation explores four fundamental principles:

1. **Streams**: Continuous learning from long-term experience
2. **Actions and Observations**: Rich interaction with the environment
3. **Rewards**: Grounded in concrete environmental signals
4. **Planning and Reasoning**: Focused on real-world consequences

## Getting Started

### Prerequisites

- Node.js 18+ 
- TypeScript
- Gemini API key (set in `.env.local`)

### Installation

```bash
# Clone this repository
git clone <repository-url>

# Install dependencies
npm install

# Configure your API key 
# (You should already have a .env.local file with GEMINI_API_KEY)
```

### Running the Demo

We offer different demos to showcase the principles:

```bash
# Run the simple demo (recommended)
npm run simple-demo

# Run the more complex demo
npm run demo

# Run the full application
npm run start
```

## Project Structure

- `src/`
  - `experiential_agent.ts` - Main agent implementation
  - `experience_stream.ts` - Manages continuous streams of experience
  - `world_model.ts` - Predicts the consequences of actions
  - `experiential_planning.ts` - Planning using the world model
  - `reward_functions.ts` - Grounded reward calculation
  - `memory.ts` - Vector memory for storing experiences
  - `rl_core.ts` - Core reinforcement learning algorithms
  - `simple-demo.ts` - Simple demo of the main principles

## Features

- **Experience Streams**: The agent maintains a continuous stream of experience and adapts over time
- **Grounded Actions**: Beyond just text responses, the agent can take actions in the environment
- **World Modeling**: The agent builds a model of the world based on its experiences
- **Experience-based Planning**: The agent plans by simulating the consequences of its actions
- **Grounded Rewards**: The agent optimizes for real-world outcomes, not just human feedback

## How It Works

1. The agent receives observations from the environment
2. It uses its past experiences to inform its predictions and actions
3. It takes actions that can include both text responses and environmental actions
4. It receives rewards based on concrete outcomes in the environment
5. It updates its world model based on new experiences
6. It plans future actions by simulating their consequences

## References

- [The Era of Experience Paper](The%20Era%20of%20Experience%20Paper%20(1).txt) - Original paper by David Silver and Richard S. Sutton
- [Gemini API Documentation](https://googleapis.github.io/js-genai/main/index.html) - Documentation for the Gemini JavaScript/TypeScript SDK

## License

MIT

## Acknowledgements
This implementation is based on "The Era of Experience" paper by David Silver and Richard S. Sutton. 