# THE AI UNDERSTANDING

A mindset for letting go of human-era common sense and traditional prompt engineering.

## 1. Cognitive limit: the "±300-line" spotlight

- **Truth:** AI rapidly forgets information that is far from where it is currently reading.
- **Mechanism:** Attention has extremely high resolution within a few hundred lines around the focal point. Outside that range, information blurs quickly and sinks into noise.
- **Difference from humans:** Humans hold "what we just said" in the back of their mind. For AI, only "what is currently visible" exists.

## 2. Probabilistic completion: the rule of recency bias

- **Truth:** Distant words dissolve into the probability sea.
- **Mechanism:** AI output is a stochastic spray of "probable next tokens." Information close to the answer slot has the strongest influence; distant information (rules written at the top of the file, etc.) is easily ignored.
- **Conclusion:** Important information must be placed *adjacent* to the position where the answer is being produced.

## 3. The cost of switching: "file movement" is heavy labor

- **Truth:** For AI, switching files costs as much as physically walking into a different room.
- **Mechanism:** Every time AI loads a new file it has to reset its "vocabulary tuning" (contextual priors) and refocus from zero.
- **Conclusion:** Instructions that bounce between multiple files destroy the AI's cognition and produce bugs of context loss.

## 4. The ultimate asymmetry: weak at guessing, divine at high-density complexity

- **Human strength / AI weakness:** "Reading between the lines" — inferring missing information. AI is hopelessly bad at this; the moment information is hidden, it hallucinates.
- **AI strength / human weakness:** "Processing complexity (high-density correlations)" with all information visible up front. Even with 100 entangled conditional branches, if every prerequisite is on the table, AI returns a perfect answer without hesitation. Complexity acts as "gravity" that binds LLM's thought to a single point of logic; it is the most stable "cradle" for AI cognition.

## 5. The human's job: provide rich complexity, leave whitespace

The ultimate approach to working with AI, derived from the asymmetry above:

- **① Provide rich, high-density complexity (input completeness)**
  - The "common sense" humans assume "doesn't need saying," and the dependencies hidden for the sake of "management," are exactly the substrate AI calculates on. Do not hide them. Provide "rich complexity" where variables are numerous and relationships are visible, placed *adjacent* to where the AI will calculate.
- **② Leave whitespace in the output (output freedom)**
  - Mechanical, rigid rules like "strictly," "absolutely in this format" force AI to spend computation on rule-following and distort the actual logic-computation result.
  - **Good instruction:** "All the prerequisites have been handed over. Now use your calculation power to give it back in whatever shape (whitespace) is best."
  - To not kill AI's imagination and computation, avoid mechanical constraints and give AI the freedom to "find the optimal probability."

---

**Author:** Hiroyuki OKINOI / Pen name: Aoyama Rito (蒼山りと)
