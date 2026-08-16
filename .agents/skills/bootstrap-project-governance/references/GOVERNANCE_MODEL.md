# Governance model

Use this reference to create or audit a repository governance baseline. Replace placeholders with verified project facts and omit irrelevant domain documents.

## Contents

1. Authority and authorization
2. Document levels and metadata
3. Recommended file map
4. Agent entry rules
5. Git and GitHub closure
6. Formal release closure
7. Current facts and plans
8. Validation checklist

## 1. Authority and authorization

Use this precedence unless the user explicitly chooses another:

1. The user's explicit instruction in the current task.
2. `LOCKED` governance documents.
3. Current code, configuration, tests, persistence schemas, and verified artifacts.
4. `LIVING` reference documents.
5. Unapproved plans and historical assumptions.

Do not edit a protected rule merely to remove a conflict with implementation. Report the drift. A generic request such as “update the docs” does not authorize changing protected governance; require the user to name the protected file or rule in the current task.

## 2. Document levels and metadata

### Levels

| Level | Purpose | Normal modification rule |
| --- | --- | --- |
| `LOCKED` | Product boundaries, document control, architecture/security, version control, and release compatibility | Current explicit user authorization required |
| `LIVING` | Architecture, configuration, data flow, behavior, tests, status, and operating guides | Update with the implementation in the same task |
| `APPEND_ONLY` | Changelog, decisions, and released version snapshots | Add entries or dated corrections; never rewrite released facts |

### Required metadata

Give each controlled document:

- document level;
- modification permission;
- applicable version or scope;
- last-checked date;
- authority sources;
- update trigger.

Keep implemented behavior, edge cases, and pending plans visibly separate. Do not describe a proposal as a current capability.

## 3. Recommended file map

Create only the files justified by the repository:

```text
AGENTS.md
CHANGELOG.md
docs/
  README.md
  governance/
    DOCUMENT_CONTROL.md
    PRODUCT_GUARDRAILS.md
    ARCHITECTURE_SECURITY.md
    GIT_VERSION_CONTROL.md
    RELEASE_AND_COMPATIBILITY.md
  reference/
    ARCHITECTURE_AND_DATA_FLOW.md
    CONFIGURATION_REGISTRY.md
    SAVE_SCHEMA_AND_MIGRATIONS.md
    TESTING_AND_ACCEPTANCE.md
    <domain-specific references>
  releases/
    TEMPLATE.md
    v<version>.md
  status/
    CURRENT_IMPLEMENTATION.md
```

Make `AGENTS.md` the entrypoint. Ensure any domain reference is reachable from it through no more than one documentation-map hop.

When configurable values are numerous, give them stable IDs in one registry with current value, type, unit, range, authority source, consumers, tests, and change impact. Domain documents should cite IDs rather than duplicate authoritative numbers.

## 4. Agent entry rules

Require every agent to:

1. Read `AGENTS.md`, document control, Git policy, relevant locked rules, the documentation map, current status, and task-specific references.
2. Inspect real files and Git state before editing.
3. State a small plan and preserve unrelated changes.
4. Update tests and living documentation with behavior changes.
5. Stop when authorization, compatibility, ownership, or safe history handling is unclear.
6. Report changed files, checks, risks, commit, push, and final status.

List every protected file identically in `AGENTS.md` and `DOCUMENT_CONTROL.md`. New protected files require authorization because both lists are themselves protected.

## 5. Git and GitHub closure

Record verified placeholders such as:

- GitHub repository: `{{OWNER}}/{{REPOSITORY}}`
- remote: `{{ORIGIN_URL}}`
- default branch: `{{DEFAULT_BRANCH}}`

For tracked changes, require:

```text
inspect -> edit -> validate -> review diff -> stage intended paths
-> check staged diff -> commit -> push -> verify remote -> report
```

Protect these boundaries:

- do not mix unrelated dirty-worktree changes;
- do not commit secrets or generated artifacts excluded by policy;
- do not use force push, destructive reset, or history rewriting without exact current authorization;
- do not claim completion when credentials, permissions, network, tests, or remote verification fail;
- let an explicit current user instruction postpone a commit or push, but report the exception and do not make it permanent.

Read-only tasks and tasks with no tracked differences do not create empty commits.

## 6. Formal release closure

Define a complete, same-version asset set appropriate to the product. For a Windows offline installer project, a typical set is:

- full Setup installer;
- cumulative offline Update installer;
- manifest containing identity, version, compatibility statement, size, and SHA-256.

A formal release must complete this sequence:

1. Obtain explicit user release intent.
2. Set one semantic version consistently in code, lockfiles, manifests, changelog, and snapshot.
3. Run automated tests and production build.
4. Build all required same-version assets.
5. Verify application identity, signature status, filenames, sizes, and hashes. Whether an unsigned artifact blocks release must be explicit in the protected project policy; never describe an unsigned artifact as signed.
6. Test clean installation and every declared upgrade path with representative user data.
7. Commit the version state and push it.
8. Create and push a new immutable `vX.Y.Z` tag pointing to the artifact-producing commit.
9. Create the matching GitHub Release using a canonical project title and upload the complete asset set.
10. Read the remote Release back and verify its title, tag, and every asset's name, size, and hash.
11. Only after remote evidence is complete, create and commit the official `APPEND_ONLY` release snapshot for the first time. Keep prerelease evidence drafts outside the controlled snapshot path.

If any gate fails, stop. Do not overwrite a prior tag or Release, narrow or fabricate compatibility, upload a partial official asset set, or treat an ordinary source push as a release.

When development builds are desired for every commit, define a separate prerelease policy with unique identifiers, retention, asset naming, and an explicit distinction from official versions. Never silently reuse formal version assets.

## 7. Current facts and plans

Use a living status document to record:

- implemented capabilities;
- known defects and architectural gaps;
- repository, remote, and release-channel state;
- missing automation or verification;
- explicitly unapproved plans.

Use release snapshots for immutable evidence, not as the sole description of current code. When Git history begins after historical binaries, say so and preserve the limits of what can be reconstructed.

## 8. Validation checklist

Before delivery, verify:

- every Markdown relative link resolves;
- every controlled document contains the required metadata;
- `AGENTS.md` and document control list the same protected paths;
- every listed protected file exists and declares `LOCKED`;
- all domain reference documents are reachable from `AGENTS.md` within two link hops;
- current values, symbol names, source paths, versions, and release artifacts were checked rather than inferred;
- tests and builds match the risk of the change;
- the staged diff contains only intended files and passes whitespace checks;
- the commit is present on the configured GitHub remote;
- a formal release, when requested, contains the complete verified asset set and immutable tag.
