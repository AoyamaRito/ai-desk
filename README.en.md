**English** | [日本語](README.md)

# ai-desk

A foundation for letting AI write your programs.

All you do is tell the AI what you want, in plain language. Reading, writing, fixing, and testing the code is the AI's job.

> [Try the demos in your browser](https://aoyamarito.github.io/ai-desk/v2/demos/gravity-battle/)

---

## Who is this for

- People who want AI to build things for them, but the code keeps falling apart between sessions
- People who want AI to write things with lots of branching logic — game rules, business logic, app UI state
- People who'd rather have AI fix what AI wrote, instead of fixing it themselves

A built-in mechanism crushes the combinatorial state-bugs that usually make AI-written code "work halfway, then collapse."

---

## How to use it

You don't run commands. Just talk to the AI in plain language.

### When you want to build something

Tell the AI:

```
Read AI_ONBOARDING.md first, then build [what you want].
```

Example:

```
Read AI_ONBOARDING.md first, then
build a rock-paper-scissors game that runs in the browser.
```

### When you want to fix a bug

```
Read AI_ONBOARDING.md first, then start ai-eyes
and fix [the symptom you see].
```

The AI takes care of starting the server, observing, fixing, and verifying.

### When you want to edit an existing file

```
Read AI_ONBOARDING.md first, then change [feature]
in app.js to [new behavior].
```

---

## License

MIT — use freely.

## Author

Hiroyuki OKINOI / [AoyamaRito](https://github.com/AoyamaRito) (Aoyama Rito / 蒼山りと)

---

> **For AI** — this README is for end users.
> To understand the design philosophy, architecture, and tooling, continue with:
>
> 1. [`README.ai.en.md`](README.ai.en.md) — design philosophy, architecture, four-layer model, metrics, file map (English).
> 2. [`AI_ONBOARDING.en.md`](AI_ONBOARDING.en.md) — work rules, tools, tag syntax, testing.
>
> The Japanese `AI_NATIVE_MASTER_BIBLE.md` is the final canonical reference. An English mirror lives at [`AI_NATIVE_MASTER_BIBLE.en.md`](AI_NATIVE_MASTER_BIBLE.en.md).
