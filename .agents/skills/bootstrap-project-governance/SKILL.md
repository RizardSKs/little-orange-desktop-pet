---
name: bootstrap-project-governance
description: Establish or update repository-wide development governance with protected AGENTS rules, LOCKED/LIVING/APPEND_ONLY documentation, Git and GitHub delivery discipline, release compatibility gates, and GitHub Release artifact requirements. Use when a user asks to create, standardize, audit, or migrate project development rules, onboarding documentation, version-control policy, release policy, or reusable multi-agent conventions.
---

# Bootstrap Project Governance

Build a small, enforceable documentation system that lets future agents discover project truth, preserve protected decisions, and complete Git/GitHub delivery consistently.

## Required reference

Read [references/GOVERNANCE_MODEL.md](references/GOVERNANCE_MODEL.md) before designing or editing governance files. Apply its structure selectively; do not create empty documents for domains the repository does not have.

## Workflow

### 1. Discover before writing

1. Read every applicable `AGENTS.md`, starting from the workspace root.
2. Inspect the repository tree, build configuration, tests, persistence format, release scripts, existing Markdown, Git status, current branch, and remotes.
3. Separate verified implementation facts from user decisions and future plans.
4. Identify existing protected documents and obtain current-task authorization before changing them.
5. State a 3–6 item edit and validation plan before making changes.

Never invent a product boundary, remote URL, application identifier, version, release asset, or compatibility claim. Discover it or ask the user.

### 2. Choose the operating mode

- **Bootstrap:** Create the minimum governance map for a repository that lacks one.
- **Update:** Change only the specifically authorized rules and synchronize dependent living documents.
- **Audit:** Report drift and blockers without writing when authorization is missing.

If an existing `LOCKED` rule conflicts with the request, stop the conflicting part unless the user explicitly authorizes that rule change in the current task.

### 3. Establish document control

Use these levels consistently:

- `LOCKED`: durable governance that agents cannot modify without current explicit authorization.
- `LIVING`: current implementation reference that changes with code, configuration, assets, or tooling.
- `APPEND_ONLY`: released history that accepts new entries or dated corrections but does not rewrite old facts.

Give every controlled document its level, modification permission, applicable version, last-checked date, authority sources, and update trigger. Register every `LOCKED` file in both `AGENTS.md` and the document-control policy.

Keep one source of truth for each numeric value or stable identifier. Link to that source from other documents instead of copying values into competing tables.

### 4. Enforce Git and GitHub delivery

For every task that changes tracked repository files:

1. Inspect status, branch, remote, existing changes, and divergence before editing.
2. Preserve unrelated user work and stage only the intended scope.
3. Run risk-proportionate validation and `git diff --cached --check`.
4. Create one intentional commit for the logical change.
5. Push the task branch to the configured GitHub remote.
6. Verify the remote commit and report branch, commit, checks, push result, and final status.

Do not create empty commits for read-only work. Do not force-push, rewrite shared history, expose credentials, or commit ignored dependencies, build outputs, installers, or temporary files without explicit authorization.

### 5. Separate pushes from formal releases

Treat ordinary source pushes and formal releases as different workflows:

- Ordinary pushes upload source history only.
- A formal release requires explicit user intent, a unique immutable semantic-version tag, the repository's full test and compatibility gates, and all required same-version artifacts.
- Keep release evidence as an untracked draft until remote evidence exists. After the gates pass, create the matching GitHub Release, upload every required installer and manifest, and verify title, tag, asset names, sizes, and hashes remotely.
- Only after remote verification, create and commit the official append-only release snapshot for the first time.
- Never overwrite an old Release asset or move a published version tag to make an incomplete release appear current.

If the repository cannot build or verify a complete release set, record the gap and stop the release. Do not relax governance to match incomplete artifacts.

### 6. Validate

Run the bundled structural validator from the skill directory:

```powershell
python scripts/validate_governance.py <repository-root>
```

If `python` is unavailable, use the environment's bundled Python executable. Also run the repository's relevant documentation checks, tests, build, and release validation required by the change.

For a new or substantially changed skill, run the skill creator's `quick_validate.py` and forward-test the skill with an independent agent before delivery.

## Delivery contract

Report:

- governance decisions established or changed;
- protected and living files changed;
- validation actually run and any unverified risks;
- Git branch, commit hash, GitHub push result, and final worktree state;
- whether a formal Release was intentionally created, skipped, or blocked.

Do not claim that rules are enforced merely because they are written. Verify navigation, protected lists, Git state, and remote results.
