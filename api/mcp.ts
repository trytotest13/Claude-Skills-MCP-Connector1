import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { promises as fs } from "node:fs";
import path from "node:path";

const SKILLS_DIR = path.join(process.cwd(), "skills");

type SkillInfo = {
  name: string;
  description: string;
  files: string[];
};

async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const result: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await walk(full)));
    } else {
      result.push(full);
    }
  }

  return result;
}

function relativeSkillPath(skillDir: string, filePath: string): string {
  return path.relative(skillDir, filePath).replaceAll(path.sep, "/");
}

async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

async function getSkillIndex(): Promise<SkillInfo[]> {
  const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
  const skills: SkillInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillDir = path.join(SKILLS_DIR, entry.name);
    const skillFile = path.join(skillDir, "SKILL.md");

    try {
      const content = await readText(skillFile);
      const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
      const description =
        heading ||
        content
          .replace(/^---[\s\S]*?---\s*/m, "")
          .split(/\n\s*\n/)
          .find((x) => x.trim().length > 0)
          ?.trim()
          .slice(0, 240) ||
        "Skill instructions";

      const allFiles = await walk(skillDir);
      skills.push({
        name: entry.name,
        description: description.replace(/\s+/g, " ").slice(0, 240),
        files: allFiles.map((f) => relativeSkillPath(skillDir, f)),
      });
    } catch {
      // A directory without SKILL.md is not exposed as a skill.
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function safeSkillName(name: string): string {
  const normalized = name.trim().replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("..") ||
    normalized.includes("\0")
  ) {
    throw new Error("Invalid skill name");
  }
  return normalized;
}

function safeRelativeFile(file: string): string {
  const normalized = file.trim().replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.includes("..") ||
    normalized.includes("\0")
  ) {
    throw new Error("Invalid file path");
  }
  return normalized;
}

function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    ...(isError ? { isError: true } : {}),
  };
}

function createServer() {
  const server = new McpServer({
    name: "claude-skills-library",
    version: "1.0.0",
  });

  server.registerTool(
    "list_skills",
    {
      title: "List Skills",
      description:
        "List all available Claude-style skills. Returns names, short descriptions, and the files available inside each skill.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      const skills = await getSkillIndex();
      return textResult(JSON.stringify({ count: skills.length, skills }, null, 2));
    }
  );

  server.registerTool(
    "search_skills",
    {
      title: "Search Skills",
      description:
        "Search the installed skill library by skill name or description. Use this before loading a full skill when you do not know its exact name.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Keywords describing the task or skill you need"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ query }) => {
      const q = query.toLowerCase().trim();
      const skills = await getSkillIndex();

      const ranked = skills
        .map((skill) => {
          const haystack = `${skill.name} ${skill.description}`.toLowerCase();
          const terms = q.split(/\s+/).filter(Boolean);
          const score = terms.reduce((n, term) => n + (haystack.includes(term) ? 1 : 0), 0);
          return { skill, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
        .map((x) => x.skill);

      return textResult(JSON.stringify({ query, count: ranked.length, skills: ranked }, null, 2));
    }
  );

  server.registerTool(
    "get_skill",
    {
      title: "Get Skill",
      description:
        "Load the complete SKILL.md instructions for one installed skill. Call this after list_skills or search_skills.",
      inputSchema: z.object({
        name: z.string().min(1).describe("Exact skill folder name, such as portfolio or impeccable"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ name }) => {
      try {
        const safe = safeSkillName(name);
        const skillDir = path.join(SKILLS_DIR, safe);
        const skillFile = path.join(skillDir, "SKILL.md");
        const content = await readText(skillFile);

        const files = (await walk(skillDir)).map((f) => relativeSkillPath(skillDir, f));

        return textResult(
          JSON.stringify(
            {
              name: safe,
              skillFile: "SKILL.md",
              files,
              content,
            },
            null,
            2
          )
        );
      } catch (error) {
        return textResult(
          `Skill not found or could not be read: ${error instanceof Error ? error.message : String(error)}`,
          true
        );
      }
    }
  );

  server.registerTool(
    "read_skill_file",
    {
      title: "Read Skill File",
      description:
        "Read a supporting file inside an installed skill, such as a reference markdown file, recipe, template, or other text asset. Paths are restricted to the selected skill directory.",
      inputSchema: z.object({
        name: z.string().min(1).describe("Exact skill folder name"),
        file: z.string().min(1).describe("Relative path inside that skill, for example reference/layout.md"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ name, file }) => {
      try {
        const safeName = safeSkillName(name);
        const safeFile = safeRelativeFile(file);

        const skillDir = path.join(SKILLS_DIR, safeName);
        const skillRoot = path.resolve(skillDir);
        const target = path.resolve(skillDir, safeFile);

        if (target !== skillRoot && !target.startsWith(`${skillRoot}${path.sep}`)) {
          throw new Error("Path escapes skill directory");
        }

        const content = await readText(target);
        return textResult(
          JSON.stringify(
            {
              name: safeName,
              file: safeFile,
              content,
            },
            null,
            2
          )
        );
      } catch (error) {
        return textResult(
          `Skill file could not be read: ${error instanceof Error ? error.message : String(error)}`,
          true
        );
      }
    }
  );

  return server;
}

// Vercel supports Web-standard Request/Response handlers.
// createMcpHandler serves the modern 2026 MCP protocol and also supports
// the 2025-era stateless handshake by default.
export default createMcpHandler(() => createServer());
