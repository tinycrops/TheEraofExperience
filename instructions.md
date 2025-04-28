────────────────────────────────────────
2. ARCHITECTURAL MAPPING (Paper → SDK)
────────────────────────────────────────
Paper concept                SDK primitive (sample file)
───────────────────────────  ───────────────────────────────────────────────
Streams of experience         Live API (live_client_content.ts / live_server.ts)
Autonomous actions            • Function calling (generate_content_with_function_calling.ts)
• Tool execution / code-exec (generate_content_with_code_execution.ts)
• API / browser control via “actions” in your own code
Grounded observations         • Inline parts (images/video/audio)
• File upload & caches (generate_content_with_file_upload.ts, caches.ts)
Grounded rewards              Your domain specific signal → pass to RL loop
Planning / reasoning          • Model generated CoT + tool use
• World-model roll-outs using generateContentStream()
Continual learning            Persist chat history, feedback & rewards; retrain or prompt-steer

────────────────────────────────────────
3. BUILD A MINIMUM “EXPERIENTIAL” LOOP
────────────────────────────────────────
Below is a skeleton of an always-on experiential agent that

receives events, 2) decides an action, 3) executes, 4) evaluates reward,
stores the transition, 6) (optionally) fine-tunes itself.
// experiental_agent.ts
import {GoogleGenAI, LiveServerMessage, Modality} from '@google/genai';
import {ReplayBuffer, PPO} from './rl_core';     // <-- roll your own or plug in RLlib
import {calcReward} from './reward_functions';  // <-- domain-specific

const opts = process.env.GOOGLE_GENAI_USE_VERTEXAI
  ? {vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT,
     location: process.env.GOOGLE_CLOUD_LOCATION}
  : {vertexai: false, apiKey: process.env.GEMINI_API_KEY};
const ai = new GoogleGenAI(opts);

// 1. Connect the long-running stream
const session = await ai.live.connect({
  model: 'gemini-2.0-flash-live-001',
  config: {responseModalities: [Modality.TEXT]},
});

const buffer = new ReplayBuffer(1e6);
const agent = new PPO({modelName: 'gemini-2.0-flash', sdk: ai});

session.onmessage = async (msg: LiveServerMessage) => {
  const obs = extractObservation(msg);          // your featuriser
  const action = await agent.act(obs);          // sample policy
  session.sendClientContent({turns: action});   // 2. execute
  const reward = await calcReward(obs, action); // 3. grounded signal
  buffer.add({obs, action, reward});
  if (buffer.size() % 512 === 0) {
    const batch = buffer.sample(2048);
    await agent.learn(batch);                   // 4. policy/value update
  }
};
Pieces you copy-paste from the samples:

• Connection & streaming → live_client_content.ts
• Function/Tool definitions → generate_content_with_function_calling.ts
• Safety settings → generate_content_with_safety_settings.ts
• Code execution wrapper → generate_content_with_code_execution.ts

────────────────────────────────────────
4. DEFINING “ACTIONS” FOR THE AGENT
────────────────────────────────────────
Option A – Pure text commands to a downstream controller (simple).

Option B – Structured function calls

const tools = [{
  functionDeclarations: [{
    name: 'click',
    parameters: { type: Type.OBJECT,
      properties: { selector:{type:Type.STRING} }, required:['selector'] }
  }, {...}] }];
Send tools in the config block; model will return response.functionCalls.

Option C – Arbitrary code; enable the internal sandbox

config: { tools:[{codeExecution:{}}] }
────────────────────────────────────────
5. HANDLING MULTIMODAL OBSERVATIONS
────────────────────────────────────────
• Images from cameras/screen → push as inlineData parts.
• PDFs/CSVs/large blobs → upload once (files.upload) then reference with
createPartFromUri(uri,mime) in every prompt; cache heavy assets via ai.caches.create.

────────────────────────────────────────
6. GROUNDING AND COMPUTING REWARDS
────────────────────────────────────────
Your reward function can mix:

Real-world telemetry (heart-rate, click-thru, latency, $$, …)
User feedback (stars, thumbs-up)
Model-based heuristics (log-prob, toxicity score)
Remember: keep the reward outside the model; the SDK only needs the value.

────────────────────────────────────────
7. PERSISTING THE STREAM
────────────────────────────────────────
The SDK gives you raw LiveServerMessages; dump them to your data-lake
(GCS, BigQuery, S3, etc.) together with actions + rewards.
That dataset is the substrate for offline RL or future supervised fine-tuning.

────────────────────────────────────────
8. ITERATING ON THE AGENT
────────────────────────────────────────
• PROMPT LEVEL:  rapid iteration – edit systemInstruction + tool config.
• POLICY LEVEL:  replace PPO with your RL algorithm of choice.
• MODEL LEVEL:   periodically fine-tune on accumulated (obs, action) pairs with high reward
using Vertex Advantage-Custom or the Gemini fine-tune endpoint.

────────────────────────────────────────
9. USEFUL COMMANDS DURING DEV
────────────────────────────────────────
Count tokens before sending:

await ai.models.countTokens({model:'gemini-2.0-flash', contents: prompt});
Abort runaway streams:

const ctrl = new AbortController();
ai.models.generateContentStream({... , config:{abortSignal:ctrl.signal}});
ctrl.abort();
────────────────────────────────────────
10. PRODUCTION CHECKLIST
────────────────────────────────────────
☑ Wrap every generateContent* call with retry/back-off logic
☑ Enforce safety settings server-side (HarmBlockMethod.SEVERITY ...)
☑ Log full request/response for model-cards & red-team review
☑ Gate high-impact actions behind a human-in-the-loop until confidence > X
☑ Implement “kill-switch” by cancelling live session & revoking key

────────────────────────────────────────
11. NEXT STEPS
────────────────────────────────────────
• Flesh out domain-specific reward and observation schemas.
• Move the policy/value nets outside of Gemini for local training if you need sub-token actions.
• Explore hierarchy: low-level PPO, high-level planning with function-calling Gemini.
• Contribute back – PRs extending sdk-samples/* with RL loops are welcome.