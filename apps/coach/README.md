# apps/coach

On-device AI coach using WebLLM with a small open model (about 1 to 2 billion parameters, such as Llama 3.2 1B, Qwen, or Gemma). Produces tone and encouragement, strictly grounded in retrieved exercise and plan data.

The coach **must not invent** exercise facts. Instructions, form cues and plans come from `services/catalogue` and `services/planner` via retrieval. A hallucinated form cue is the worst output this system can produce.

- **Status.** Scaffold only. Implementation lands in Stage 5.
- **Proposed language.** TypeScript (pending owner approval).
- **Runs where.** Entirely in the browser.
- **Depends on.** `services/catalogue`, `services/planner`.
- **Events in.** None.
- **Events out.** None.

See `docs/architecture.md` for context.
