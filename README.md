# Claude Skills MCP Connector

A remote MCP server for Claude that exposes a local library of Claude-style `SKILL.md`
packages stored in this repository.

## Included skill sources

This project was assembled from the three uploaded ZIP files:

- `taste-skill-main.zip`
- `skills-main.zip`
- `impeccable-main.zip`

The actual skill folders are under `skills/`. Supporting files inside each skill are
preserved so a model can load references/templates/recipes on demand.

## MCP tools

### `list_skills`
Returns all discovered skills, their descriptions, and their available files.

### `search_skills`
Searches skill names/descriptions.

Example:
```json
{"query":"portfolio design"}
```

### `get_skill`
Loads the full `SKILL.md` for one skill.

Example:
```json
{"name":"impeccable"}
```

### `read_skill_file`
Loads a supporting file inside a skill without allowing path traversal.

Example:
```json
{"name":"impeccable","file":"reference/layout.md"}
```

## Deploy to Vercel

Requirements:

- Node.js 20+
- A Vercel account
- A GitHub repository

Install:

```bash
npm install
```

Check TypeScript:

```bash
npm run typecheck
```

Run locally:

```bash
npx vercel dev
```

The MCP endpoint is:

```text
http://localhost:3000/mcp
```

After deployment it will be:

```text
https://YOUR-PROJECT.vercel.app/mcp
```

## Connect to Claude

Add the deployed `/mcp` endpoint as a remote MCP/custom connector in the Claude
interface available to your account.

## How Claude should use it

Recommended flow:

1. `search_skills` for the task.
2. `get_skill` for the best matching skill.
3. `read_skill_file` only when the skill references additional files.
4. Apply the returned instructions to the user's task.

## Important

This connector does not modify Claude's built-in Skill system. It exposes the uploaded
skill packages as MCP-accessible content. Claude reads the returned instructions and
uses them in the conversation.

## Updating skills

Replace/add folders under `skills/`, commit, and push to GitHub. Vercel will deploy
the new version automatically if Git integration is enabled.

## Security

The connector is read-only. It does not execute scripts from the skill packages.
`read_skill_file` is restricted to paths inside the selected skill directory.


## Vercel configuration

This project intentionally does not set a `functions.runtime` value in `vercel.json`.
Vercel automatically detects the Node.js runtime for `api/mcp.ts`.

The Node.js major is pinned to `24.x` in `package.json`. Vercel supports Node.js 22+,
and Node.js 20 is scheduled for deprecation on October 1, 2026.

If an older deployment is cached, redeploy after committing the updated
`vercel.json` and `package.json`.


## Windows GitHub helper

After extracting this project, open the project folder and double-click:

```text
push-to-github.bat
```

It initializes Git if necessary, creates the `main` branch, configures the GitHub
remote, commits the project, and asks for confirmation before force-pushing to the
configured repository.

Configured repository:

```text
https://github.com/trytotest13/Claude-Skills-MCP-Connector
```

Only use the force-push option if you want the local project to replace the current
`main` branch on GitHub.
