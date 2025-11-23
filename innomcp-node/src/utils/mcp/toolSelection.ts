/**
 * Tool Selection Logic
 * Handles pattern matching, keyword matching, and AI-based tool selection
 */

import * as natural from "natural";
import Fuse from "fuse.js";
import { MCPTool, MCPResource, ToolPattern } from "./types";
import { makeFuse, runSearch } from "./fuseSearch";
import { CATEGORY_KEYWORDS } from "./constants";

export class ToolSelectionEngine {
  private tokenizer = new natural.WordTokenizer();
  private stemmer = natural.PorterStemmer;

  /**
   * ตรวจสอบว่าเป็นคำถามทักทายหรือไม่
   */
  isGreetingQuery(query: string): boolean {
    const greetingPatterns = [
      /^(สวัสดี|hi|hello|hey)/i,
      /^(good\s*(morning|afternoon|evening))/i,
    ];
    return greetingPatterns.some((p) => p.test(query.trim()));
  }

  /**
   * ประมาณคะแนนความเกี่ยวข้องของ tool กับคำถาม
   */
  async scoreToolRelevance(
    toolName: string,
    userMessage: string,
    tools: Map<string, MCPTool>,
    resources: Map<string, MCPResource>,
    tokenizeThaiWithOllama: (text: string) => Promise<string[]>
  ): Promise<number> {
    const tool = tools.get(toolName);
    const resource = resources.get(toolName);

    if (!tool && !resource) return 0;

    const description = tool?.description || resource?.description || "";
    const keywords =
      tool?.keywords || (await this.extractKeywords(toolName, description));
    const searchText = `${toolName} ${description} ${keywords.join(
      " "
    )}`.toLowerCase();

    let userTokens: string[] = [];
    try {
      userTokens = await tokenizeThaiWithOllama(userMessage);
      const englishTokens =
        this.tokenizer.tokenize(userMessage.toLowerCase()) || [];
      userTokens = [...new Set([...userTokens, ...englishTokens])];
    } catch (error) {
      userTokens = this.tokenizer.tokenize(userMessage.toLowerCase()) || [];
    }

    // TF-IDF scoring
    let tfidfScore = 0;
    const tempTfidf = new natural.TfIdf();
    tempTfidf.addDocument(searchText);
    userTokens.forEach((token) => {
      tempTfidf.tfidfs(token, (i, measure) => {
        tfidfScore += measure;
      });
    });
    tfidfScore = Math.min(tfidfScore * 10, 50);

    // Fuse.js scoring
    const fuse = new Fuse([searchText], {
      includeScore: true,
      threshold: 0.4,
      ignoreLocation: true,
    });

    let fuseScore = 0;
    for (const token of userTokens) {
      if (token.length < 2) continue;
      const results = fuse.search(token.toLowerCase());
      if (results.length > 0) {
        fuseScore += Math.max(0, (1 - (results[0].score || 1)) * 100);
      }
    }
    fuseScore = fuseScore / Math.max(userTokens.length, 1);

    // Category bonus
    let categoryScore = 0;
    if (tool?.category) {
      const catKeys = CATEGORY_KEYWORDS[tool.category] || [];
      const matches = catKeys.filter((k) =>
        userTokens.some((t) => t.toLowerCase().includes(k.toLowerCase()))
      );
      categoryScore = matches.length * 5;
    }

    const totalScore = tfidfScore + fuseScore + categoryScore;
    console.log(
      `[MCP Client] Score for ${toolName}: ${totalScore.toFixed(
        2
      )} (TF-IDF: ${tfidfScore.toFixed(1)}, Fuse: ${fuseScore.toFixed(
        1
      )}, Category: ${categoryScore})`
    );

    return totalScore;
  }

  /**
   * จัดลำดับและลบค่าซ้ำของ tools
   */
  async deduplicateAndRankTools(
    candidates: string[],
    userMessage: string,
    tools: Map<string, MCPTool>,
    resources: Map<string, MCPResource>,
    tokenizeThaiWithOllama: (text: string) => Promise<string[]>
  ): Promise<string[]> {
    if (candidates.length === 0) return [];

    const uniqueCandidates = [...new Set(candidates)];

    const scoredTools = await Promise.all(
      uniqueCandidates.map(async (toolName) => ({
        toolName,
        score: await this.scoreToolRelevance(
          toolName,
          userMessage,
          tools,
          resources,
          tokenizeThaiWithOllama
        ),
      }))
    );

    const sorted = scoredTools
      .filter((t) => t.score > 0)
      .sort((a, b) => b.score - a.score);

    // Greeting special case
    if (this.isGreetingQuery(userMessage)) {
      const greetingResource = sorted.find(
        (t) => t.toolName.includes("greeting") && resources.has(t.toolName)
      );
      if (greetingResource) return [greetingResource.toolName];
    }

    const topScore = sorted[0]?.score || 0;
    const selected = sorted
      .filter((t) => t.score >= topScore * 0.7)
      .slice(0, 10);

    return selected.map((t) => t.toolName);
  }

  /**
   * ใช้ pattern matching เพื่อเลือก tools
   */
  async tryPatternMatching(
    userMessage: string,
    toolPatterns: ToolPattern[],
    tools: Map<string, MCPTool>,
    resources: Map<string, MCPResource>,
    tokenizeThaiWithOllama: (text: string) => Promise<string[]>
  ): Promise<string[]> {
    if (this.isGreetingQuery(userMessage)) {
      const greetingResources = Array.from(resources.keys()).filter((k) =>
        k.includes("greeting")
      );
      if (greetingResources.length > 0) return [greetingResources[0]];
    }

    const patternData = toolPatterns.map((p) => ({
      category: p.category,
      keywords: p.keywords.join(" "),
      pattern: p,
    }));

    const patternFuse = makeFuse(patternData as any, {
      keys: ["keywords", "category"],
      threshold: 0.35,
    });

    const results = runSearch(patternFuse, userMessage.toLowerCase()) as any[];
    const toolScores = new Map<string, number>();

    for (const pr of results) {
      const origPattern: ToolPattern = pr.item.pattern;
      const priorityScore = origPattern.priority === "high" ? 15 : 8;

      const matchedTools = Array.from(tools.keys()).filter((k) =>
        origPattern.toolPattern.test(k)
      );
      const matchedResources = Array.from(resources.keys()).filter((k) =>
        origPattern.toolPattern.test(k)
      );

      const allMatches = [...matchedTools, ...matchedResources];
      const score = (1 - (pr.score ?? 0)) * 100 * (priorityScore / 10);

      allMatches.forEach((tool) => {
        const current = toolScores.get(tool) || 0;
        toolScores.set(tool, current + score);
      });
    }

    const candidates = Array.from(toolScores.entries())
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score >= 10)
      .map(([tool]) => tool);

    return await this.deduplicateAndRankTools(
      candidates,
      userMessage,
      tools,
      resources,
      tokenizeThaiWithOllama
    );
  }

  /**
   * ใช้ keyword matching เพื่อเลือก tools
   */
  async tryKeywordMatching(
    userMessage: string,
    tools: Map<string, MCPTool>,
    resources: Map<string, MCPResource>,
    tokenizeThaiWithOllama: (text: string) => Promise<string[]>
  ): Promise<string[]> {
    const thaiTokens = await tokenizeThaiWithOllama(userMessage);
    const englishTokens =
      this.tokenizer.tokenize(userMessage.toLowerCase()) || [];
    const allTokens = [...new Set([...thaiTokens, ...englishTokens])];

    const toolData = Array.from(tools.entries()).map(([toolName, tool]) => ({
      id: toolName,
      searchText: `${toolName} ${tool.description} ${tool.keywords.join(
        " "
      )}`.toLowerCase(),
    }));

    const resourceData = Array.from(resources.entries()).map(
      ([resourceName, resource]) => ({
        id: resourceName,
        searchText:
          `${resourceName} ${resource.description} ${resource.title}`.toLowerCase(),
      })
    );

    const combined = [...toolData, ...resourceData];
    const dataFuse = makeFuse(combined as any, {
      keys: ["searchText"],
      threshold: 0.6,
      ignoreLocation: true,
    });

    const tokenResults: any[] = [];
    for (const token of allTokens) {
      if (token.length < 2) continue;
      const results = runSearch(dataFuse, token) as any[];
      tokenResults.push(...results);
    }

    const seen = new Set<string>();
    const uniqueResults = tokenResults.filter((r) => {
      if (seen.has(r.item.id)) return false;
      seen.add(r.item.id);
      return true;
    });

    const matches = uniqueResults
      .map((r) => ({
        id: r.item.id,
        score: Math.max(0, (1 - (r.score ?? 1)) * 100),
      }))
      .filter((m) => m.score >= 10)
      .sort((a, b) => b.score - a.score)
      .map((m) => m.id);

    return await this.deduplicateAndRankTools(
      matches,
      userMessage,
      tools,
      resources,
      tokenizeThaiWithOllama
    );
  }

  /**
   * ใช้ AI เพื่อเลือก tools
   */
  async tryAISelection(
    userMessage: string,
    tools: Map<string, MCPTool>,
    resources: Map<string, MCPResource>,
    chatWithOllama: (messages: any[], options?: any) => Promise<any>,
    getToolDescriptions: (
      tools: Map<string, MCPTool>,
      resources?: Map<string, MCPResource>
    ) => Promise<string>
  ): Promise<string[]> {
    try {
      const allTools = Array.from(tools.keys());
      const allResources = Array.from(resources.keys());
      const allItems = [...allTools, ...allResources].slice(0, 50);

      const selectedTools = new Map<string, MCPTool>();
      const selectedResources = new Map<string, MCPResource>();

      for (const itemName of allItems) {
        if (tools.has(itemName)) {
          selectedTools.set(itemName, tools.get(itemName)!);
        } else if (resources.has(itemName)) {
          selectedResources.set(itemName, resources.get(itemName)!);
        }
      }

      const toolDescriptions = await getToolDescriptions(
        selectedTools,
        selectedResources
      );

      const prompt = `เลือก tool ที่เหมาะสมสำหรับคำถาม (สูงสุด 3 tools)

คำถาม: "${userMessage}"

${toolDescriptions}

กฎ:
1. เลือก 1-3 tools ที่เกี่ยวข้อง
2. ถ้าไม่มี tool ที่เหมาะสม ตอบ "none"
3. ถ้าต้องการหลาย tools (เช่น ดึงข้อมูลแล้วสร้างกราฟ) ให้เลือกหลายตัว

ตอบเฉพาะชื่อ tool คั่นด้วย comma หรือ "none":`;

      const response = await chatWithOllama(
        [{ role: "user", content: prompt }],
        { temperature: 0.1, num_predict: 100 }
      );

      const rawText = String(response?.message?.content || "").trim();

      if (rawText.toLowerCase().includes("none")) {
        console.log("[MCP Client] AI selection: no suitable tools");
        return [];
      }

      const selectedItems = rawText
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        .map((t) => {
          return allItems.find(
            (item) => item === t || item.endsWith(`:${t}`) || item.includes(t)
          );
        })
        .filter((t) => t) as string[];

      return await this.deduplicateAndRankTools(
        selectedItems,
        userMessage,
        tools,
        resources,
        async (text) => {
          return [];
        }
      );
    } catch (error) {
      console.error("[MCP Client] AI selection error:", error);
      return [];
    }
  }

  /**
   * ดึงคีย์เวิร์ดจากชื่อและคำอธิบาย tool
   */
  async extractKeywords(
    name: string,
    description?: string,
    tokenizeThaiWithOllama?: (text: string) => Promise<string[]>
  ): Promise<string[]> {
    const text = `${name} ${description || ""}`;

    let thaiTokens: string[] = [];
    try {
      if (tokenizeThaiWithOllama) {
        thaiTokens = await tokenizeThaiWithOllama(text);
      }
    } catch (error) {
      console.warn("[MCP Client] Thai tokenization failed:", error);
    }

    const englishTokens = this.tokenizer.tokenize(text.toLowerCase()) || [];
    const allTokens = [...new Set([...thaiTokens, ...englishTokens])];

    const englishWords = allTokens.filter((token) => /^[a-z]{3,}$/.test(token));
    const englishStopWords = [
      "tool",
      "function",
      "method",
      "the",
      "and",
      "for",
      "with",
    ];
    const filteredEnglish = englishWords.filter(
      (w) => !englishStopWords.includes(w)
    );

    const thaiWords = allTokens.filter((token) =>
      /[\u0E00-\u0E7F]{2,}/.test(token)
    );
    const thaiStopWords = ["การ", "ของ", "ที่", "และ", "ใน"];
    const filteredThai = thaiWords.filter((w) => !thaiStopWords.includes(w));

    const stemmedEnglish = filteredEnglish.map((w) => this.stemmer.stem(w));

    return [...new Set([...stemmedEnglish, ...filteredThai])].slice(0, 20);
  }

  /**
   * ทำให้ query เป็นรูปแบบมาตรฐาน
   */
  normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, " ");
  }
}
