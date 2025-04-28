"use strict";
/**
 * ExperienceStream
 *
 * Implements the "Streams" concept from the Era of Experience paper.
 * Enables the agent to maintain a continuous stream of experience over time,
 * rather than isolated episodes. This allows for long-term goals, adaptation,
 * and learning over extended periods.
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
exports.ExperienceStream = exports.StreamState = void 0;
exports.getExperienceStream = getExperienceStream;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Stream states to track progress toward goals
var StreamState;
(function (StreamState) {
    StreamState["ACTIVE"] = "active";
    StreamState["PAUSED"] = "paused";
    StreamState["COMPLETED"] = "completed";
    StreamState["ABANDONED"] = "abandoned"; // Stream was abandoned before goal completion
})(StreamState || (exports.StreamState = StreamState = {}));
/**
 * ExperienceStream manages a continuous stream of agent experiences
 * toward accomplishing long-term goals
 */
class ExperienceStream {
    constructor(streamId, worldModel, memory) {
        this.experiences = [];
        this.goals = [];
        this.state = StreamState.ACTIVE;
        this.streamId = streamId;
        this.worldModel = worldModel;
        this.memory = memory;
        this.createdAt = new Date();
        this.lastUpdatedAt = new Date();
        // Create stream directory if it doesn't exist
        const streamDir = path.join(process.cwd(), 'data', 'streams', streamId);
        if (!fs.existsSync(streamDir)) {
            fs.mkdirSync(streamDir, { recursive: true });
        }
        // Try to load existing stream data if available
        this.loadFromDisk();
    }
    /**
     * Add a new experience to the stream
     */
    async addExperience(experience) {
        // Add timestamp if not present
        const timestampedExperience = {
            ...experience,
            timestamp: new Date().toISOString()
        };
        // Add to the experiences array
        this.experiences.push(timestampedExperience);
        this.lastUpdatedAt = new Date();
        // Update the world model with this experience
        await this.worldModel.update(timestampedExperience);
        // Update progress toward goals
        this.updateGoalProgress(timestampedExperience);
        // Persist to disk
        this.saveToDisk();
    }
    /**
     * Add a new goal to the stream
     */
    addGoal(goal) {
        this.goals.push({
            ...goal,
            timeframe: goal.timeframe || { start: new Date() }
        });
        this.saveToDisk();
    }
    /**
     * Update a goal's metrics based on new experience
     */
    updateGoalProgress(experience) {
        for (const goal of this.goals) {
            // Simple example for a health-related goal with step count metric
            if (experience.obs?.healthMetrics?.steps) {
                if (goal.metrics.steps) {
                    goal.metrics.steps.current = experience.obs.healthMetrics.steps;
                }
            }
            // Example for a learning goal with test score metric
            if (experience.obs?.educationMetrics?.testScore) {
                if (goal.metrics.testScore) {
                    goal.metrics.testScore.current = experience.obs.educationMetrics.testScore;
                }
            }
            // Check if goal is achieved
            if (this.calculateGoalProgress(goal) >= 1.0) {
                // Mark goal as achieved in some way
                goal.completedAt = new Date();
            }
        }
    }
    /**
     * Calculate progress toward a specific goal (0-1)
     */
    calculateGoalProgress(goal) {
        if (!goal.metrics || Object.keys(goal.metrics).length === 0) {
            return 0;
        }
        let totalProgress = 0;
        let totalWeight = 0;
        for (const [key, metric] of Object.entries(goal.metrics)) {
            if (metric.target === metric.current) {
                totalProgress += metric.weight;
            }
            else if (metric.target > metric.current) {
                // For increasing metrics (like steps, study hours)
                const progress = Math.min(1, Math.max(0, metric.current / metric.target));
                totalProgress += progress * metric.weight;
            }
            else {
                // For decreasing metrics (like weight loss, error rate)
                const startValue = metric.baseline || metric.target * 1.5; // Estimate if no baseline
                const progress = Math.min(1, Math.max(0, (startValue - metric.current) / (startValue - metric.target)));
                totalProgress += progress * metric.weight;
            }
            totalWeight += metric.weight;
        }
        return totalWeight > 0 ? totalProgress / totalWeight : 0;
    }
    /**
     * Get recent experiences from the stream
     */
    getRecentExperiences(limit = 10) {
        return this.experiences.slice(-limit);
    }
    /**
     * Get all goals with their current progress
     */
    getGoalsWithProgress() {
        return this.goals.map(goal => ({
            ...goal,
            progress: this.calculateGoalProgress(goal)
        }));
    }
    /**
     * Look back at past experiences to extract insights
     */
    async analyzeExperienceHistory() {
        // This would use the world model to analyze patterns in the experience stream
        // For now, we'll return a simple summary
        return {
            experienceCount: this.experiences.length,
            firstExperience: this.experiences.length > 0 ? new Date().toISOString() : null,
            lastExperience: this.experiences.length > 0 ? new Date().toISOString() : null,
            activeGoals: this.goals.filter(g => !g.completedAt).length,
            completedGoals: this.goals.filter(g => g.completedAt).length
        };
    }
    /**
     * Save stream data to disk
     */
    saveToDisk() {
        const streamDir = path.join(process.cwd(), 'data', 'streams', this.streamId);
        // Save metadata
        const metadata = {
            streamId: this.streamId,
            state: this.state,
            createdAt: this.createdAt,
            lastUpdatedAt: this.lastUpdatedAt,
            experienceCount: this.experiences.length,
            goals: this.goals
        };
        fs.writeFileSync(path.join(streamDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
        // Save recent experiences
        // To avoid one huge file, save only the most recent experiences in the main file
        const recentExperiences = this.experiences.slice(-100);
        fs.writeFileSync(path.join(streamDir, 'recent_experiences.json'), JSON.stringify(recentExperiences, null, 2));
        // For long-term storage, append to an experiences log file
        // This is more efficient for large streams as we don't rewrite the whole file
        const latestExperience = this.experiences[this.experiences.length - 1];
        if (latestExperience) {
            fs.appendFileSync(path.join(streamDir, 'experiences.ndjson'), JSON.stringify(latestExperience) + '\n');
        }
    }
    /**
     * Load stream data from disk
     */
    loadFromDisk() {
        const streamDir = path.join(process.cwd(), 'data', 'streams', this.streamId);
        // Load metadata if it exists
        const metadataPath = path.join(streamDir, 'metadata.json');
        if (fs.existsSync(metadataPath)) {
            try {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                this.state = metadata.state;
                this.createdAt = new Date(metadata.createdAt);
                this.lastUpdatedAt = new Date(metadata.lastUpdatedAt);
                this.goals = metadata.goals;
            }
            catch (error) {
                console.error(`Error loading stream metadata: ${error}`);
            }
        }
        // Load experiences
        const experiencesPath = path.join(streamDir, 'experiences.ndjson');
        if (fs.existsSync(experiencesPath)) {
            try {
                const content = fs.readFileSync(experiencesPath, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                this.experiences = lines.map(line => JSON.parse(line));
            }
            catch (error) {
                console.error(`Error loading experiences: ${error}`);
            }
        }
    }
    /**
     * Get stream status summary
     */
    getStatus() {
        return {
            streamId: this.streamId,
            state: this.state,
            experienceCount: this.experiences.length,
            createdAt: this.createdAt,
            lastUpdatedAt: this.lastUpdatedAt,
            goals: this.getGoalsWithProgress(),
            recentExperiences: this.getRecentExperiences(5)
        };
    }
}
exports.ExperienceStream = ExperienceStream;
/**
 * Factory function to create or load an experience stream
 */
async function getExperienceStream(streamId, worldModel, memory) {
    return new ExperienceStream(streamId, worldModel, memory);
}
//# sourceMappingURL=experience_stream.js.map