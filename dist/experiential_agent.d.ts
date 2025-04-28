import { FunctionDeclaration } from '@google/genai';
interface LiveServerMessage {
    serverContent?: any;
    [key: string]: any;
}
interface LiveSession {
    sendClientContent: (content: any) => void;
    close: () => void;
}
export interface Experience {
    obs: any;
    reward: number | {
        total: number;
        user?: number;
        latency?: number;
        accuracy?: number;
        [key: string]: any;
    };
    done: boolean;
    next_obs?: any;
    action?: any;
    sessionId: string;
    log_prob?: number;
    value?: number;
}
export declare function persistExperience(experience: Experience): Promise<void>;
export interface ToolSchema extends FunctionDeclaration {
}
export declare const WebSearchToolSchema: ToolSchema;
export declare const EnvironmentActionSchema: ToolSchema;
export declare const PlanningToolSchema: ToolSchema;
export declare function handleLiveMessage({ msg, session, buffer, agent, sessionId, persistExperience, vectorMemory }: {
    msg: LiveServerMessage;
    session: LiveSession;
    buffer: any;
    agent: any;
    sessionId: string;
    persistExperience: (exp: Experience) => Promise<void>;
    vectorMemory: any;
}): Promise<void>;
export declare function runExperientialAgent(): Promise<LiveSession>;
export {};
