import { Injectable, Logger } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Loads the support knowledge base used to auto-resolve routine tickets.
 *
 * The KB is a single Markdown file (`knowledge-base.md`) checked into the repo
 * next to the API workspace root. It is small enough (~a few KB) to feed whole
 * into one model prompt, so there is no chunking/embedding pipeline here — the
 * pgvector `KbChunk` RAG setup is reserved for the planned reply-drafting step,
 * which loads DB-stored articles rather than this file. If the KB grows beyond
 * what fits comfortably in context, swap `getContent()` for retrieval.
 *
 * The file is read once (lazily, on first use) and cached for the process
 * lifetime. Edit the file and restart the server to pick up changes.
 *
 * `process.cwd()` is the `api/` workspace dir in both `nest start --watch`
 * (dev) and `node dist/main` (prod), so a bare relative path resolves to
 * `api/knowledge-base.md`. Override the location with `KNOWLEDGE_BASE_PATH`
 * (still relative to the api workspace, or an absolute path).
 */
@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);
  private cache?: string;

  /** Absolute path to the knowledge-base markdown file. */
  private readonly filePath = resolve(
    process.cwd(),
    process.env.KNOWLEDGE_BASE_PATH ?? "knowledge-base.md",
  );

  getContent(): string {
    if (this.cache !== undefined) return this.cache;
    this.cache = readFileSync(this.filePath, "utf8");
    this.logger.log(`Loaded knowledge base from ${this.filePath} (${this.cache.length} chars).`);
    return this.cache;
  }
}
