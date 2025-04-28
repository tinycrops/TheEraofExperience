"use strict";
/**
 * Experiential Planning
 *
 * This module implements the Planning and Reasoning principles from The Era of Experience paper.
 * Rather than just reasoning with language, the agent plans by predicting the concrete consequences
 * of its actions on the world, including future observations and rewards.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExperientialPlanner = void 0;
/**
 * ExperientialPlanner uses the world model to plan sequences of actions
 * oriented toward achieving specific goals
 */
class ExperientialPlanner {
    constructor(genAI, worldModel, memory, modelName = 'gemini-2.0-flash') {
        this.genAI = genAI;
        this.worldModel = worldModel;
        this.memory = memory;
        this.modelName = modelName;
    }
    /**
     * Generate a plan to achieve a goal
     */
    async createPlan(currentObservation, goal, possibleActions, maxSteps = 5, searchDepth = 3) {
        // Initialize the plan
        const plan = {
            goal,
            steps: [],
            estimatedReward: 0,
            confidence: 0,
            timeframe: {
                start: new Date(),
                estimatedCompletion: new Date(Date.now() + 3600000) // Default 1 hour from now
            }
        };
        let currentState = currentObservation;
        let totalReward = 0;
        let totalConfidence = 0;
        // Apply Monte Carlo Tree Search (MCTS) to find the best sequence of actions
        for (let i = 0; i < maxSteps; i++) {
            // 1. Simulate multiple potential action sequences to find the best next action
            const bestAction = await this.findBestNextAction(currentState, goal, possibleActions, searchDepth);
            if (!bestAction)
                break;
            // 2. Predict outcome of the selected action
            const prediction = await this.worldModel.predictNextState(currentState, bestAction.action);
            // 3. Add this step to the plan
            plan.steps.push({
                action: bestAction.action,
                predictedObs: prediction.predictedObs,
                predictedReward: prediction.predictedReward,
                confidence: prediction.confidence,
                completed: false,
                explanations: bestAction.reasoning
            });
            // 4. Update running totals and current state for next iteration
            totalReward += prediction.predictedReward;
            totalConfidence += prediction.confidence;
            currentState = prediction.predictedObs;
        }
        // Calculate overall plan metrics
        plan.estimatedReward = totalReward;
        plan.confidence = plan.steps.length > 0 ? totalConfidence / plan.steps.length : 0;
        // Estimate completion time based on number of steps
        plan.timeframe.estimatedCompletion = new Date(plan.timeframe.start.getTime() + (plan.steps.length * 600000) // 10 minutes per step
        );
        return plan;
    }
    /**
     * Find the best next action using lookahead search
     */
    async findBestNextAction(currentState, goal, possibleActions, depth = 3) {
        if (possibleActions.length === 0)
            return null;
        // For each possible action, simulate the outcome and evaluate
        const actionEvaluations = await Promise.all(possibleActions.map(async (action) => {
            try {
                // Predict immediate outcome
                const prediction = await this.worldModel.predictNextState(currentState, action);
                // If we're at depth 1, just use the immediate reward
                if (depth <= 1) {
                    return {
                        action,
                        value: prediction.predictedReward * prediction.confidence,
                        reasoning: `Direct value: ${prediction.predictedReward.toFixed(2)}`
                    };
                }
                // Otherwise, recursively evaluate future actions
                let futureValue = 0;
                if (depth > 1) {
                    // Recursively find best action from predicted state (with reduced depth)
                    const nextBestAction = await this.findBestNextAction(prediction.predictedObs, goal, possibleActions, depth - 1);
                    if (nextBestAction) {
                        // Apply discount factor (0.9) to future rewards
                        futureValue = 0.9 * nextBestAction.value;
                    }
                }
                // Evaluate how this affects progress toward goal
                const goalProgress = this.evaluateGoalProgress(prediction.predictedObs, goal);
                // Calculate total expected value
                const totalValue = (prediction.predictedReward + // Immediate reward
                    futureValue + // Discounted future rewards
                    goalProgress * 0.5 // Bonus for goal progress
                ) * prediction.confidence; // Weight by confidence
                return {
                    action,
                    value: totalValue,
                    reasoning: `Immediate: ${prediction.predictedReward.toFixed(2)}, Future: ${futureValue.toFixed(2)}, Goal: ${goalProgress.toFixed(2)}, Confidence: ${prediction.confidence.toFixed(2)}`
                };
            }
            catch (error) {
                console.error('Error evaluating action:', error);
                return { action, value: -1, reasoning: "Evaluation failed" };
            }
        }));
        // Sort by value and return the best action
        actionEvaluations.sort((a, b) => b.value - a.value);
        return actionEvaluations[0]?.value > 0 ? actionEvaluations[0] : null;
    }
    /**
     * Evaluate how a state contributes to goal progress (0-1)
     */
    evaluateGoalProgress(state, goal) {
        // This is a simplified version - in a real system, this would be more sophisticated
        // and tailored to specific goal types
        let progress = 0;
        let metricsEvaluated = 0;
        // Evaluate each goal metric
        for (const [key, metric] of Object.entries(goal.metrics)) {
            // Check if the state has a value for this metric
            if (state[key] !== undefined) {
                const currentValue = state[key];
                if (metric.target === currentValue) {
                    // Exact match
                    progress += 1 * metric.weight;
                }
                else if (metric.target > currentValue) {
                    // For increasing metrics
                    progress += Math.min(1, Math.max(0, currentValue / metric.target)) * metric.weight;
                }
                else {
                    // For decreasing metrics
                    const startValue = metric.baseline || metric.target * 1.5;
                    progress += Math.min(1, Math.max(0, (startValue - currentValue) / (startValue - metric.target))) * metric.weight;
                }
                metricsEvaluated += metric.weight;
            }
        }
        return metricsEvaluated > 0 ? progress / metricsEvaluated : 0;
    }
    /**
     * Update a plan with actual outcomes after an action is taken
     */
    async updatePlan(plan, stepIndex, actualExperience) {
        // Make sure the step exists
        if (stepIndex < 0 || stepIndex >= plan.steps.length) {
            throw new Error(`Step index ${stepIndex} out of bounds (0-${plan.steps.length - 1})`);
        }
        // Update the step with actual outcomes
        const step = plan.steps[stepIndex];
        step.completed = true;
        step.actualObs = actualExperience.next_obs;
        step.actualReward = actualExperience.reward;
        // If this created a significant deviation from predictions, we should replan
        const needsReplanning = this.shouldReplan(step);
        if (needsReplanning && stepIndex < plan.steps.length - 1) {
            // Create a new plan starting from current state
            const newRemainingSteps = await this.createPlan(actualExperience.next_obs, plan.goal, plan.steps.map(s => s.action), // Use same action space
            plan.steps.length - stepIndex - 1, // Plan remaining steps
            3 // Search depth
            );
            // Replace the remaining steps in the plan
            plan.steps = [
                ...plan.steps.slice(0, stepIndex + 1),
                ...newRemainingSteps.steps
            ];
            // Update plan metrics
            plan.estimatedReward = plan.steps.reduce((sum, s) => {
                if (s.completed) {
                    if (typeof s.actualReward === 'number') {
                        return sum + s.actualReward;
                    }
                    else if (s.actualReward && typeof s.actualReward === 'object' && 'total' in s.actualReward) {
                        return sum + s.actualReward.total;
                    }
                }
                return sum + s.predictedReward;
            }, 0);
            const confidenceValues = plan.steps.map(s => s.confidence);
            plan.confidence = confidenceValues.reduce((sum, c) => sum + c, 0) / confidenceValues.length;
        }
        return plan;
    }
    /**
     * Determine if we need to replan based on deviation from predictions
     */
    shouldReplan(step) {
        if (!step.actualObs) {
            return false; // Can't compare without actual observations
        }
        // Get the actual reward value regardless of type
        let actualRewardValue;
        if (typeof step.actualReward === 'number') {
            actualRewardValue = step.actualReward;
        }
        else if (step.actualReward && typeof step.actualReward === 'object' && 'total' in step.actualReward) {
            actualRewardValue = step.actualReward.total;
        }
        else {
            return false; // Can't compare without proper reward format
        }
        // Check reward deviation
        const rewardDeviation = Math.abs((actualRewardValue - step.predictedReward) / Math.max(0.1, Math.abs(step.predictedReward)));
        // If reward is significantly different (more than 50%), replan
        if (rewardDeviation > 0.5) {
            return true;
        }
        // For observation deviation, we'd need a more sophisticated comparison
        // This is a simplified check
        const predictedStr = JSON.stringify(step.predictedObs);
        const actualStr = JSON.stringify(step.actualObs);
        // If the actual observation is vastly different in structure or size, replan
        if (Math.abs(actualStr.length - predictedStr.length) / Math.max(1, predictedStr.length) > 0.3) {
            return true;
        }
        return false;
    }
    /**
     * Generate potential actions based on current observation and goal
     */
    async generatePotentialActions(observation, goal, actionTypes = ['message', 'tool']) {
        try {
            // Use Gemini to generate potential actions
            const contents = [{
                    role: 'user',
                    parts: [{ text: `
          Given the current observation and goal, generate a list of potential actions
          the agent could take. For each action, explain why it might be useful.
          
          Current observation:
          ${JSON.stringify(observation, null, 2)}
          
          Goal:
          ${JSON.stringify(goal, null, 2)}
          
          Desired action types: ${actionTypes.join(', ')}
          
          Return a JSON array of potential actions, with each action having:
          - type: "${actionTypes.join('" or "')}"
          - content: the action content
          - reasoning: why this action is helpful toward the goal
          
          Return at least 3 diverse actions in valid JSON format only. Do not include any explanatory text before or after the JSON array.
        ` }]
                }];
            // Get generated actions from model
            const model = this.genAI.models;
            const result = await model.generateContent({
                model: this.modelName,
                contents,
                config: {
                    temperature: 0.7
                }
            });
            // Parse response
            let actions = [];
            const responseText = result.text || '[]';
            try {
                // Extract JSON array from text response
                const jsonMatch = responseText.match(/\[[\s\S]*\]/);
                const jsonStr = jsonMatch ? jsonMatch[0] : '[]';
                actions = JSON.parse(jsonStr);
            }
            catch (e) {
                console.error('Error parsing generated actions:', e);
                console.log('Raw response:', responseText);
                return [];
            }
            return actions;
        }
        catch (error) {
            console.error('Error generating potential actions:', error);
            return [];
        }
    }
    /**
     * Explain a plan in natural language
     */
    async explainPlan(plan) {
        try {
            const contents = [{
                    role: 'user',
                    parts: [{ text: `
          Explain this plan in clear, natural language. Describe what each step is trying to achieve
          and how it contributes to the overall goal. Make it conversational and easy to understand.
          
          Goal: ${plan.goal.description}
          
          Plan steps:
          ${plan.steps.map((step, i) => `Step ${i + 1}: ${JSON.stringify(step.action)}\n`).join('')}
        ` }]
                }];
            // Get explanation from model
            const model = this.genAI.models;
            const result = await model.generateContent({
                model: this.modelName,
                contents,
                config: {
                    temperature: 0.7
                }
            });
            return result.text || 'Explanation not available';
        }
        catch (error) {
            console.error('Error explaining plan:', error);
            return 'Explanation not available';
        }
    }
}
exports.ExperientialPlanner = ExperientialPlanner;
//# sourceMappingURL=experiential_planning.js.map