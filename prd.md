────────────────────────────────────────────────────────
CRITIQUE OF CURRENT IMPLEMENTATION vs. “ERA OF EXPERIENCE”
────────────────────────────────────────────────────────
Streams of experience – Grade B-
• Strengths: src/experiential_agent.ts opens a long-lived ​live​ session and saves every turn to NDJSON (ensureDataDirectory → persistExperience). ReplayBuffer gives O(1) add/sample.
• Gaps:
– No memory pruning; tokenCost() is an 𝑶(|json|) approximation.
– No long-term recall; once a batch is learned the raw context is forgotten.
– Single threaded; one conversation = one stream → flywheel speed limited.

Actions & Observations – Grade C
• Strengths: agent.act() can output plain text or pseudo functionCalls.
• Gaps:
– Schemas for tools are commented out; not passed to live.connect.
– No example of multi-modal input (image / files) even though SDK provides Modality.IMAGE, File.upload, etc.
– Observations are only serverContent.text; latent state such as groundingMetadata, safety ratings, etc. is thrown away.

Grounded Reward – Grade C-
• Strengths: reward_functions.ts combines relevance + exploration.
• Gaps:
– User feedback is mocked; no hook from demo.ts.
– RelevanceReward queries the same generation model; leakage / self-agreement risk.
– No external measurements (web search, telemetry, KPI).
– No negative-reward channel for safety filters / blocked content.

Planning & Reasoning – Grade D
• Strengths: PPO wrapper exists.
• Gaps:
– No parameter update; “learning” just prompts the same model.
– Value estimation asks the LLM for a float – very slow & noisy.
– No world-model; no lookahead; no explicit chain-of-thought.
– No usage of SDK tunings (model tuning jobs) or caches.

Flywheel speed – Overall C
The four pillars exist in prototype form but the loop is not yet self-reinforcing; experience is saved, but neither distilled into memory nor used to produce a measurably stronger policy.

────────────────────────────────────────────────────────
ACTIONABLE IMPROVEMENT PLAN
────────────────────────────────────────────────────────
0. Keep the Gemini-only constraint (.cursorrules). All snippets below compile under @google/genai 0.4.x.

Memory / Long-Horizon Streams
1.1 Introduce a Vector Memory module (src/memory.ts).
– On every observation, call ai.models.embedContent({model:'text-embedding-004', contents:obsTxt}).
– Store {embedding, obsId, metadata} in a lightweight vector store (e.g. in-process HNSW or sqlite blob).
1.2 Prior to agent.act(), retrieve top-K similar memories and feed them as context parts.
1.3 Add nightly summarisation job (see sdk-samples/generate_content_streaming.ts):
– Chunk yesterday’s NDJSON, summarise with generateContentStream → write daily_summary.md → files.upload for cheap cold storage.

Actions: first-class tool use
2.1 Uncomment and extend tools array in live.connect:

tools:[{functionDeclarations:[{
    name:'webSearch',description:'SERP',parameters:{type:'object',
       properties:{query:{type:'string'}},required:['query']}}]}]
2.2 In onmessage(), detect functionCall in msg.serverContent; if present, run the function (fetch, DB query, …) and stream the result back with session.sendClientContent.
2.3 Add Modality.IMAGE input pathway: if user pastes an image, first upload via files.upload then pass createPartFromUri in sendClientContent. (Reuse ImageUpload.tsx logic.)

Grounded, scalable rewards
3.1 Wire demo.ts feedback prompt into reward_functions.ts: persist rating in Experience.info and use it in userFeedbackReward().
3.2 Add an automated “critic” model that is different from the policy model:
const CRITIC_MODEL='gemini-2.0'; use it inside relevanceReward to avoid self-agreement.
3.3 Integrate grounded metrics: e.g. response latency, cost, or external API success.
experience.reward += latency_penalty + http_success_bonus.

Upgrade PPO to a real update loop
4.1 Replace generateContent-based value estimation with a small local regression (TensorFlow.js dense net) trained on (obsEmbedding, return).
Call memory.embedContent to get obsEmbedding.
4.2 Move “learn” out of process loop; run a periodic worker that:
– Samples ReplayBuffer,
– Computes advantages,
– Finetunes a tuning job via SDK Tunings API:

await genAI.tunings.create({model:'gemini-2.0-flash',datasetUri:file.uri});
Until tunings GA is ready, approximate by building an “instruction prefix” that includes distilled high-advantage exemplars, saved to ./prompts/policy_prefix.txt and prepended in agent.act().

Token & context hygiene
5.1 Replace tokenCost() with official countTokens():

const n = (await genAI.models.countTokens({model,contents})).totalTokens;
5.2 Add sliding-window truncation: if historyTokens > 16k – retrieve last N user/model turns + top-K memories.

Observability & Flywheel Automation
6.1 Emit Prometheus-style metrics (buffer size, reward mean, latency).
6.2 Create scripts/cron_retrain.sh which:
– Zips previous day’s NDJSON,
– Uploads with files.upload,
– Triggers step 4 worker,
– Reports new policy BLEU/reward on held-out validation chat set.

Safety & Filtering
7.1 Pass systemInstruction that enforces policy compliance.
7.2 Intercept safetyFilters in serverContent and set reward –1 for blocked outputs.

Testing hardening
8.1 Add integration test that uses the real Gemini ​countTokens​ endpoint but mocks generateContent (to catch API drift).
8.2 Property-based tests on ReplayBuffer.size()/sample().

────────────────────────────────────────────────────────
“FLYWHEEL” QUICK-START CHECKLIST
────────────────────────────────────────────────────────
A. Capture   live.connect → persistExperience → embedContent
B. Recall    similarity search → prepend memories
C. Act       policy_prefix + current obs → generateContent / functionCalling
D. Measure    calcReward (user + critic + metrics)
E. Learn      batch sample → PPO/Tuning update → commit new policy_prefix
F. Deploy     restart agent with new prefix; repeat daily

Each arrow above is backed by a concrete Gemini GenAI SDK call (live.connect, embedContent, generateContent, countTokens, files.upload, tunings.create). Once the nightly worker (Step E) is automated, the flywheel will spin continuously, compounding capability with every 24 h of accumulated experience.

