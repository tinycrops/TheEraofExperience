tinycrops/TheEraofExperience
Engineering-notes – v0.2
Audience: senior SW engineer already fluent in TypeScript, RL and the Google Gen-AI SDK
Purpose: tell you ONLY what you still need to know to take the PoC and push it toward a real “Era-of-Experience” agent as fast as possible.

────────────────────────────────────────

Bootstrap / sanity check (10 min) ──────────────────────────────────────── pnpm i # already in repo pnpm run test # jest green? if not, fix before new work pnpm run dev # expect the CLI to bring up a stub Live session, print “Session opened”
If any of the above is red, stop and repair – everything else assumes the skeleton is healthy.

────────────────────────────────────────
2. Core mental model
────────────────────────────────────────
Think of the agent as a three-loop system:

Loop A (online stream)
Live connection → extractObservation → PPO.policy(observation) → sendClientContent(action)
Loop B (online credit assignment)
reward_functions.calcReward(observation,action) → ReplayBuffer.add(exp) → persistExperience(ndjson)
Loop C (offline update, every N steps)
ReplayBuffer.sample → PPO.learn(batch) → internal policy/value nets updated via in-context examples (for now)

Our job for the next week is to increase the bandwidth & quality of each arrow while still keeping iteration <5 min.

────────────────────────────────────────
3. GenAI-SDK usage recipes we rely on
────────────────────────────────────────
3.1 Live stream (Gemini Dev API)
const session = await ai.live.connect({
model: 'gemini-2.0-flash-live-001',
config: {responseModalities:[Modality.TEXT]},
callbacks
});

3.2 Plain content generation
await ai.models.generateContent({...})

3.3 Function calling
Pass tools:[{functionDeclarations:[…]}] + toolConfig.functionCallingConfig.
We parse response.functionCalls in experiential_agent.act – extend as needed.

3.4 Token counter
await ai.models.countTokens({model,contents})

You shouldn’t need any other SDK surface this sprint.

────────────────────────────────────────
4. Immediate engineering tasks
────────────────────────────────────────

ID	What	Hint (file)
T-2-1	Replace mock Live with real stream	src/experiential_agent.ts → remove jest‐stub switch, wire ai.live.connect
T-2-2	Dependency-inject GoogleGenAI once	Create src/infra/genai_client.ts, export singleton
T-2-3	Introduce “Experience” interface	Already declared; refactor ReplayBuffer.add callers
T-2-4	Make ReplayBuffer O(1) ring	src/rl_core.ts – fill TODOs, make sure next_obs logic correct
T-2-5	Finish PPO (GAE, clipping, value loss)	We stay “LLM-in-loop” for policy/value; you only need advantage computation & batching
T-2-6	Reward v0 (thumbs, relevance, exploration)	reward_functions.ts already scaffolded; flesh out userFeedback pluggable channel
T-2-7	NDJSON persistence	ensureDataDirectory(), persistExperience are ready; just verify race-safety under 100 QPS
T-2-8	Jest e2e (stub Live server)	tests/experiential_agent.test.ts – expand with fake streaming
T-2-9	OpenTelemetry traces	util/telemetry.ts (create) – wrap SDK calls
T-2-10	Docs generation	add “typedoc” devDep, hook to npm run build
Work in ascending order; each task should keep tests green.

────────────────────────────────────────
5. Mapping paper → code hotspots
────────────────────────────────────────

Paper pillar	Concrete hook
Streams of experience	ReplayBuffer + NDJSON + live_env.ts (to add). Long-running session, don’t reset history between runs.
Grounded actions/obs	env/live_env.ts will forward raw LiveServerMessage AND any external sensor APIs (files.upload, etc.).
Grounded rewards	reward/ directory. Start with synthetic (LLM relevance). Next week wire real metrics (HTTP sensors).
Planning & reasoning	PPO.act already sends “generate_action” prompt; create world_model.ts later for imagination rollouts.
────────────────────────────────────────
6. Prompt patterns (keep consistent)
────────────────────────────────────────

generate_action
{task:'generate_action',observation:{…}}
• The LLM should output EITHER plain text OR “function: name(args)”

estimate_value
{task:'estimate_value',observation:{…}}
• Expect a single float (0-1). Keep prompt short; countTokens before call.

update_policy
{task:'update_policy',experiences:[…]}
• We throw top-k high-advantage trajectories back at the model (poor-man’s in-context RL). Weight=advantage.

If you change prompt schema update tests and docs.

────────────────────────────────────────
7. Performance guard-rails
────────────────────────────────────────
• Hard cap 2 K context tokens; truncate chat history with extractCuratedHistory() when >1.8 K.
• Store only hashes in explorationTracking to avoid memory blow-up.
• Use AbortController on Live stream idle >30 s.
• Wrap every SDK call with withRetry() (exponential back-off 200 ms * 2^n).

────────────────────────────────────────
8. Analytics / dashboards
────────────────────────────────────────
Add util/metrics.ts that exports recordReward, recordLatency, recordToken.
Send to stdout as NDJSON (will pipe into Grafana later).
Key plots: rolling mean reward, token-per-reward ratio,  p99 latency.

────────────────────────────────────────
9. Coding conventions specific to this repo
────────────────────────────────────────
• Pure ESM modules except tests (commonjs ok).
• No top-level await outside CLI entrypoints.
• All public funcs RETURN Promise, never rely on process.exit in libs.
• Put side-effect imports only in src/index.ts or demo.ts.
• All TODO/FIXME must have your GH handle and date (e.g. TODO(ai-senior-04-27): …).

────────────────────────────────────────
10. Workflow checklist for every PR
────────────────────────────────────────
[ ] jest passes + >90 % branch cov on changed lines
[ ] pnpm run lint clean
[ ] pnpm run build succeeds
[ ] Added line to /logs/YYYY-MM-DD.md with hypothesis & outcome
[ ] If reward distribution changed → update baseline in docs

────────────────────────────────────────
11. 48 h horizon
────────────────────────────────────────
Once Live streaming + PPO loop yields totalReward ≠ 0 for a 2-minute run, ping me.
Next phase will add:
• live_env image / file modalities
• simple world_model.ts (language-only)
• R2D2 swap-in

Build fast, break nothing—let the agent grow by itself.