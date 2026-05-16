import { z } from "zod";
import { logBoth } from "../../utils/mcpLogger";

const GovDataToolInputSchema = z.object({
  query: z.string().describe("Search query for datasets, such as census, health, or transportation"),
  rows: z.number().min(1).max(100).default(10).describe("Number of results to return"),
  category: z.string().optional().describe("Optional keyword/category filter"),
});

type GovDataToolInput = z.infer<typeof GovDataToolInputSchema>;

interface CatalogDataset {
  identifier?: string;
  slug?: string;
  name?: string;
  title?: string;
  description?: string;
  notes?: string;
  metadata_created?: string;
  metadata_modified?: string;
  last_harvested_date?: string;
  publisher?: string;
  organization?: {
    title?: string;
    name?: string;
    slug?: string;
  };
  keyword?: string[];
  tags?: Array<{ name: string }>;
  distribution_titles?: string[];
  landingPage?: string;
  resources?: Array<{
    id?: string;
    name?: string;
    description?: string;
    format?: string;
    url?: string;
  }>;
}

interface CatalogSearchResponse {
  total?: number;
  count?: number;
  results?: CatalogDataset[];
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function formatDate(value: string | undefined): string {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US");
}

function catalogBaseUrl(): string {
  return process.env.DATAGOV_CATALOG_BASE_URL || "https://catalog.data.gov";
}

async function searchGovData(params: GovDataToolInput): Promise<string> {
  const startTime = Date.now();

  try {
    const url = new URL("/search", catalogBaseUrl());
    url.searchParams.set("q", params.query);
    url.searchParams.set("per_page", String(params.rows));
    url.searchParams.set("sort", "last_harvested_date");

    if (params.category) {
      url.searchParams.append("keyword", params.category);
    }

    logBoth("INFO", `[GovDataTool] Searching: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "INNOMCP/1.0 (MCP Tool)",
      },
    });

    if (!response.ok) {
      throw new Error(`Data.gov API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as CatalogSearchResponse;
    const duration = Date.now() - startTime;
    const datasets = Array.isArray(data.results) ? data.results : [];
    const totalCount = Number(data.total ?? data.count ?? datasets.length);

    logBoth("INFO", `[GovDataTool] Found ${totalCount} datasets in ${duration}ms`);

    if (datasets.length === 0) {
      return JSON.stringify(
        {
          success: true,
          query: params.query,
          totalFound: 0,
          results: [],
          message: "No datasets found. Try a broader search term.",
        },
        null,
        2,
      );
    }

    return formatGovData(datasets, totalCount, params.query, duration);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const message = error?.message || String(error);
    logBoth("ERROR", `[GovDataTool] Error after ${duration}ms: ${message}`);

    return JSON.stringify(
      {
        success: false,
        error: message,
        query: params.query,
        duration: `${duration}ms`,
        hint: "Try broader search terms like census, health, education, or transportation",
      },
      null,
      2,
    );
  }
}

function formatGovData(datasets: CatalogDataset[], totalCount: number, query: string, duration: number): string {
  let output = "US Government Open Data\n\n";
  output += `Query: "${query}"\n`;
  output += `Found: ${totalCount.toLocaleString()} datasets (showing ${datasets.length})\n`;
  output += `Duration: ${duration}ms\n\n`;
  output += "---\n\n";

  datasets.forEach((dataset, index) => {
    const title = dataset.title || dataset.name || dataset.slug || dataset.identifier || "Untitled dataset";
    const datasetSlug = dataset.slug || dataset.name;
    const organization = dataset.organization?.title || dataset.organization?.name || dataset.publisher || "N/A";
    const notes = dataset.notes || dataset.description || "";
    const keywordTags = dataset.keyword || dataset.tags?.map((tag) => tag.name) || [];
    const modified = formatDate(dataset.metadata_modified || dataset.last_harvested_date);

    output += `${index + 1}. **${title}**\n`;
    output += `   ID: ${datasetSlug || dataset.identifier || "N/A"}\n`;
    output += `   Organization: ${organization}\n`;
    output += `   Created: ${formatDate(dataset.metadata_created)}, Modified/Harvested: ${modified}\n`;

    if (notes) {
      output += `   ${stripHtml(notes).slice(0, 240)}${stripHtml(notes).length > 240 ? "..." : ""}\n`;
    }

    if (keywordTags.length > 0) {
      output += `   Tags: ${keywordTags.slice(0, 5).join(", ")}\n`;
    }

    if (dataset.resources && dataset.resources.length > 0) {
      output += `   Resources (${dataset.resources.length}):\n`;
      dataset.resources.slice(0, 3).forEach((resource) => {
        output += `      - ${resource.format || "N/A"}: ${resource.name || "Unnamed"}\n`;
        if (resource.url) output += `        ${resource.url}\n`;
      });
    }

    if (dataset.distribution_titles && dataset.distribution_titles.length > 0) {
      output += `   Distributions: ${dataset.distribution_titles.slice(0, 3).join(", ")}\n`;
    }

    output += `   View: ${dataset.landingPage || (datasetSlug ? `https://catalog.data.gov/dataset/${datasetSlug}` : "https://catalog.data.gov")}\n\n`;
  });

  output += "---\n\n";
  output += "Search completed successfully";

  return output;
}

export const govDataTool = {
  name: "govdata",
  description:
    "Search US government open data from Data.gov. Access census, health, education, transportation, environment, and thousands of other datasets. Returns dataset metadata and download links.",
  inputSchema: GovDataToolInputSchema,
  execute: async (args: unknown) => {
    const parsed = GovDataToolInputSchema.safeParse(args);
    if (!parsed.success) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: false,
                error: "Invalid input",
                details: parsed.error.issues,
                hint: "Try queries like census population, health statistics, or transportation data",
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    const result = await searchGovData(parsed.data);
    return {
      content: [{ type: "text" as const, text: result }],
    };
  },
};

export default govDataTool;
