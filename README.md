# jev

`jev` asks questions about text and answers in a way shell scripts can use.

It reads from files or pipes, understands meaning (not just keywords), and returns a short answer plus an exit code. Use it like `grep` or `test`, but for meaning.

```bash
cat error.log | jev noul -i "Is this a database error?"
# → true

git diff | jev noul -i "Modifies database schema?" && echo "migration needed"
```

Powered by [TypeSafe Jev](https://typesafe.ai).

## Install

```bash
npm install -g @phatng/jev-cli

# Or build a native binary with Bun for <10ms startup:
bun run compile && cp ./jev /usr/local/bin/jev
```

Set your API key (pick one):

```bash
jev auth set-key "your-key"   # saved securely to ~/.jev/config.json
# or export TYPESAFE_API_KEY="your-key"
```

## Commands

There are 4 main commands. All accept files as arguments or text via stdin.

| Command | What it does | Example |
| :--- | :--- | :--- |
| `jev noul` | Yes/no question. Returns `true` or `false`. | `cat msg.txt \| jev noul -i "Customer wants to cancel?"` |
| `jev choice` | Pick one option from a list. | `cat error.log \| jev choice -c "db,auth,network" -q` |
| `jev score` | Rate text on a scale you define. | `cat crash.log \| jev score -l "minor,moderate,critical" -q` |
| `jev eval` | Answer several questions at once from a spec file. | `cat ticket.json \| jev eval --spec ./spec.json` |

Helpers:

- `jev auth` — manage API key (`jev auth set-key <key>`, `jev auth status`, `jev auth logout`)
- `jev models` — list models (`jev models list`) or set default (`jev models set-default <name>`)
- `jev add-skill` — install instructions so AI agents (Claude, Codex, Cursor, Antigravity) can use `jev`

Run any command with `--help` for all flags, or `--json` for full machine-readable output.

## Examples

```bash
# Filter logs by meaning (like grep, but semantic)
cat auth.log | jev noul -i "Credential stuffing attempt?" --filter --stream

# Use in an if statement (exit 0 = true, 1 = false)
if jev noul -i "Customer threatens churn?" message.txt; then
  ./alert-support.sh message.txt
fi

# Handle filenames safely with null bytes
find ./docs -name "*.md" -print0 | xargs -0 jev noul -i "Contains API keys?" --filter -z

# Let your AI agent use jev
jev add-skill
```

## Exit codes

| Code | Meaning |
| :--- | :--- |
| `0` | Yes / condition met / success |
| `1` | No / condition not met / no lines matched |
| `2` | Your command was invalid (missing flag, bad JSON) |
| `3` | API or network error |

`noul` exits `0` when the probability meets `--threshold` (default `0.5`).

## License

MIT © [Phat Nguyen](https://github.com/RyanNg1403)
