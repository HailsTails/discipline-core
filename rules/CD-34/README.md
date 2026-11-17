# CD-34: Secrets never enter the repo

## Rule

Secrets live only in the environment or a secrets manager — never in source, never in logs, never in URL query parameters. A committed secret is compromised the moment it lands in history, whatever happens to it later; the repository is not a place a secret can safely exist.

Review lens: [clean-architecture](../../methods/lenses/clean-architecture.md). The lens reviews the whole rule, including what no check flags. How it is checked: [CHECKS.md](CHECKS.md). The thinking behind every rule: [the spirit of the rules](../SPIRIT.md).

## Spirit

**What the friction is for.** A secret in history is compromised for good. The friction keeps secrets out of the repository entirely, so there is nothing to leak.

**What a finding points at.** Match the sites against these causes.
- *Configuration mixed with code.* Credentials sit in source because config has no other home. Read them from the environment or a secrets manager.
- *Test credentials that are real.* Tests use live keys. Use dummy or generated test values.

**Where to go.** Source holds no secrets. Secrets arrive at runtime from the environment or a secrets manager.

**Reactions to distrust.**
- "It's a private repository." Access changes, history stays.

**Principles behind it.**
- *Config in the environment* (The Twelve-Factor App). Configuration that varies by deploy, credentials included, lives outside the code.
