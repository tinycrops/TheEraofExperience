Primary goal: rapidly mature the current PoC into a self-improving experiential agent that embodies the four pillars in Silver & Sutton’s “Era of Experience” paper while using the Google Gen AI TypeScript SDK as the only model interface.

────────────────────────────────────────

Local bootstrap ──────────────────────────────────────── 1.1 Node & tooling • Use Node 18 LTS. • npm i -g pnpm (faster mono-repo iterations) then pnpm i. • pnpm test --watch for TDD loop.
1.2 Environment
 . env keys expected:
 - GEMINI_API_KEY – for Gemini Dev API
 - GOOGLE_CLOUD_PROJECT / LOCATION – for Vertex path when you want to switch.
Use .env.dev, .env.prod for quick context switches; dotenv-flow already installed.

1.3 Project entry‐points
src/index.ts           → CLI bootstrap, graceful shut-down
src/experiential_agent.ts
src/rl_core.ts          → PPO, ReplayBuffer (stub)
src/reward_functions.ts → reward shaping
tests/*                 → Jest CI guard rail

Immediate TODO list (highest ROE^1 first)
────────────────────────────────────────
T-#  | Title                                   | Rough Effort
---- | --------------------------------------- | ------------
2-1  | Replace mock Live session with real ai.live.connect stream. Use gemini-2.0-flash-live-001 by default.     | S – 1 day
2-2  | Scrap the mock SDK wrapper; instantiate a real GoogleGenAI once and DI it everywhere.                      | S
2-3  | Introduce a thin “Experience” interface: {obs, reward, done} so we can later swap in other envs.           | S
2-4  | Flesh out ReplayBuffer to include next_obs, done, info. Add ring-buffer indices for O(1) push/pull.   | M
2-5  | Finish PPO: advantage calc, GAE(λ), clipping, value loss. Use CPU ops first; we can off-load to TFJS later.  | M-L
2-6  | Reward v0: use user “thumbs-up/down” + synthetic relevance (Gemini evaluators) + random exploration bonus.    | S
2-7  | Add persistence: dump every transition to /data/YYYY-MM-DD/stream.ndjson.                                   | S
2-8  | Write e2e Jest that spins an in-process Live session with stubbed server, validates one PPO update.           | M
2-9  | Telemetry: OpenTelemetry exporter; log latency, token counts, reward stats.                                   | S
2-10 | Docs: update README + generate typedoc artefacts on build.                                                   | S
^1 ROE = “Return on Experiment”

How to use the Google Gen AI SDK primitives
────────────────────────────────────────
3.1 Streams of Experience

const session = await ai.live.connect({
  model: 'gemini-2.0-flash-live-001',
  config: {responseModalities:[Modality.TEXT]},
  callbacks: {onmessage, onopen, onerror, onclose}
});
Pipe every LiveServerMessage into extractObservation.

3.2 Autonomous actions
Actions are produced by PPO as one of:
A) Plain natural-language (fast iteration).
B) Structured tool call:

config: {tools:[{functionDeclarations:[{name:'webSearch',parameters:{…}}]}]}
If response.functionCalls appears, route to the corresponding executor (in /src/tools/ you’ll create).

3.3 Grounded observations
Images/CSVs use files.upload once then createPartFromUri().
Telemetry sensors attach as inlineData parts so the model can “see” context.

3.4 Grounded rewards
Keep reward calc outside the model. reward_functions.ts should:
• Pull live metrics (HTTP, database, etc.)
• Combine with last user feedback and intrinsic bonus.
Return a single scalar.

3.5 Planning / reasoning
For long-horizon tasks call the same Gemini model in “planner” mode:

await ai.models.generateContent({
  model:'gemini-2.0-pro',
  contents:[ systemPrompt, currentStateText ],
  config:{temperature:0.1,maxOutputTokens:4096}
});
Run roll-outs offline; store into buffer as “imagined” transitions with lower weight.

Folder / module plan
────────────────────────────────────────
src/
├─ agent/                → policy + value nets
│   ├─ ppo.ts
│   └─ world_model.ts    (future)
├─ env/                  → wrappers around Live, CLI, Simulators
│   ├─ live_env.ts
│   └─ mock_env.ts
├─ reward/               → reward sources & aggregation
├─ tools/                → real-world action executors (search, db, browser)
├─ data/                 → streamed NDJSON & sqlite index
└─ util/                 → logging, token_count, retry, metrics

Experimentation workflow
────────────────────────────────────────
Step 0  pnpm dev – start hot-reload loop
Step 1  Build a new reward feature → add Jest, run pnpm test
Step 2  Spin up a 5-minute live session with npm run sandbox, watch Grafana dashboard
Step 3  If avg reward ↑ by ≥15 % over baseline, commit behind feature flag.
Step 4  Nightly cron runs 1-hour session, dumps dataset; compare AUC curves.

Coding guidelines specific to SDK
────────────────────────────────────────
• Always call countTokens before sending history >2 K tokens.
• Use AbortController to kill any streaming response after 30 s idle.
• Wrap SDK calls with exponential back-off on 429, 5xx.
• Use HarmBlockMethod.BLOCK_NONE in dev; restore policy settings for prod.

Safety knobs (even if security ≠ concern)
────────────────────────────────────────
Add .env boolean DEV_UNSAFE=true; if false enforce:

config:{safetySettings:[{category:'HARM_CATEGORY_DANGEROUS',threshold:'BLOCK_SOME'}]}
Helps avoid model returning disallowed function calls in production.

8. Longer-term roadmap
────────────────────────────────────────
Q2
• Swap PPO for R2D2 with prioritized replay to leverage long sequences.
• Fine-tune Gemini via Vertex-Tuning on high-reward trajectories.
• Add multimodal perception; pipe webcam frames every N seconds.
• Introduce hierarchical agent: top-level planner (Gemini), low-level controller (RL).

Q3
• Persistent memory: vector-store of high-value snippets via embedContent.
• Integrate Veo video generation for “idea > storyboard > video” workflow.
• Run on-device policy net (WebGPU) for low-latency reflexes.

9. Reference code in sdk-samples to borrow
────────────────────────────────────────
Sample file                              What to re-use

sdk-samples/live_client_content.ts       Live connection scaffolding
sdk-samples/generate_content_with_code_execution.ts  Built-in Python sandbox
sdk-samples/generate_content_with_function_calling.ts Function declaration format
sdk-samples/generate_content_with_file_upload.ts      File upload + polling
sdk-samples/generate_content_streaming.ts             Iterative chunk handling

10. Quick snippets
────────────────────────────────────────
Token counter

export async function tokenCost(contents){ 
  const res = await ai.models.countTokens({model:'gemini-2.0-flash',contents});
  return res.totalTokens;
}
Retry helper

export async function withRetry(fn, tries=3){
  for(let i=0;;i++){try{return await fn();}catch(e){if(i>=tries)throw e;await wait(2**i*200);}}
}
11. Deliverables cadence
────────────────────────────────────────
• Daily: short experiment log in /logs/YYYY-MM-DD.md – hypothesis, diff, reward delta.
• Weekly: PR with green Jest, npm run lint, updated docs.
• Monthly: “Era-scorecard” – table showing progress on each of the four paper pillars.

Kick off by executing tasks 2-1 → 2-4; ping me (the human operator) when Live streaming PPO is learning non-zero reward so we can iterate on richer environments.

Happy hacking & let the agent grow through its own experience!