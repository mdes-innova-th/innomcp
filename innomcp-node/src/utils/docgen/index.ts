/**
 * Documentation Generator Module
 * à¸ªà¸£à¹‰à¸²à¸‡à¹€à¸­à¸à¸ªà¸²à¸£à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´
 * 
 * Features:
 * - API documentation generation
 * - Module documentation
 * - Markdown generation
 * - Code examples
 * 
 * @module utils/docgen
 */

import { logBoth } from '../mcpLogger';
import * as fs from 'fs';
import * as path from 'path';

/**
 * API Endpoint Documentation
 */
export interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  requestBody?: {
    type: string;
    example: any;
  };
  responses: {
    status: number;
    description: string;
    example: any;
  }[];
}

/**
 * Module Documentation
 */
export interface ModuleDoc {
  name: string;
  description: string;
  version?: string;
  author?: string;
  functions?: {
    name: string;
    description: string;
    parameters: { name: string; type: string; description: string }[];
    returns: { type: string; description: string };
    examples?: string[];
  }[];
  classes?: {
    name: string;
    description: string;
    methods: { name: string; description: string }[];
  }[];
}

/**
 * Documentation Generator
 */
class DocGenerator {
  private outputDir: string;

  constructor() {
    this.outputDir = path.join(process.cwd(), 'docs');
    this.ensureOutputDir();
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate API documentation
   */
  generateAPIDoc(endpoints: APIEndpoint[], title: string = 'API Documentation'): string {
    let markdown = `# ${title}\n\n`;
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    markdown += `---\n\n`;

    // Group by method
    const byMethod = new Map<string, APIEndpoint[]>();
    for (const endpoint of endpoints) {
      if (!byMethod.has(endpoint.method)) {
        byMethod.set(endpoint.method, []);
      }
      byMethod.get(endpoint.method)!.push(endpoint);
    }

    // Generate documentation for each method
    for (const [method, endpoints] of byMethod) {
      markdown += `## ${method} Endpoints\n\n`;

      for (const endpoint of endpoints) {
        markdown += `### ${method} ${endpoint.path}\n\n`;
        markdown += `${endpoint.description}\n\n`;

        // Parameters
        if (endpoint.parameters && endpoint.parameters.length > 0) {
          markdown += `**Parameters:**\n\n`;
          markdown += `| Name | Type | Required | Description |\n`;
          markdown += `|------|------|----------|-------------|\n`;
          for (const param of endpoint.parameters) {
            markdown += `| ${param.name} | \`${param.type}\` | ${param.required ? 'Yes' : 'No'} | ${param.description} |\n`;
          }
          markdown += `\n`;
        }

        // Request Body
        if (endpoint.requestBody) {
          markdown += `**Request Body:**\n\n`;
          markdown += `Type: \`${endpoint.requestBody.type}\`\n\n`;
          markdown += `\`\`\`json\n${JSON.stringify(endpoint.requestBody.example, null, 2)}\n\`\`\`\n\n`;
        }

        // Responses
        markdown += `**Responses:**\n\n`;
        for (const response of endpoint.responses) {
          markdown += `- **${response.status}** ${response.description}\n\n`;
          markdown += `  \`\`\`json\n  ${JSON.stringify(response.example, null, 2)}\n  \`\`\`\n\n`;
        }

        markdown += `---\n\n`;
      }
    }

    return markdown;
  }

  /**
   * Generate module documentation
   */
  generateModuleDoc(module: ModuleDoc): string {
    let markdown = `# ${module.name}\n\n`;
    markdown += `${module.description}\n\n`;

    if (module.version) {
      markdown += `**Version:** ${module.version}\n\n`;
    }
    if (module.author) {
      markdown += `**Author:** ${module.author}\n\n`;
    }

    markdown += `---\n\n`;

    // Functions
    if (module.functions && module.functions.length > 0) {
      markdown += `## Functions\n\n`;

      for (const func of module.functions) {
        markdown += `### ${func.name}\n\n`;
        markdown += `${func.description}\n\n`;

        // Parameters
        if (func.parameters.length > 0) {
          markdown += `**Parameters:**\n\n`;
          for (const param of func.parameters) {
            markdown += `- \`${param.name}\` (\`${param.type}\`): ${param.description}\n`;
          }
          markdown += `\n`;
        }

        // Returns
        markdown += `**Returns:** \`${func.returns.type}\` - ${func.returns.description}\n\n`;

        // Examples
        if (func.examples && func.examples.length > 0) {
          markdown += `**Examples:**\n\n`;
          for (const example of func.examples) {
            markdown += `\`\`\`typescript\n${example}\n\`\`\`\n\n`;
          }
        }

        markdown += `---\n\n`;
      }
    }

    // Classes
    if (module.classes && module.classes.length > 0) {
      markdown += `## Classes\n\n`;

      for (const cls of module.classes) {
        markdown += `### ${cls.name}\n\n`;
        markdown += `${cls.description}\n\n`;

        markdown += `**Methods:**\n\n`;
        for (const method of cls.methods) {
          markdown += `- \`${method.name}\`: ${method.description}\n`;
        }
        markdown += `\n`;

        markdown += `---\n\n`;
      }
    }

    return markdown;
  }

  /**
   * Generate README
   */
  generateREADME(config: {
    title: string;
    description: string;
    installation?: string[];
    usage?: string[];
    features?: string[];
    apiDocs?: string;
    contributing?: string;
    license?: string;
  }): string {
    let markdown = `# ${config.title}\n\n`;
    markdown += `${config.description}\n\n`;

    // Installation
    if (config.installation) {
      markdown += `## Installation\n\n`;
      for (const step of config.installation) {
        markdown += `${step}\n`;
      }
      markdown += `\n`;
    }

    // Usage
    if (config.usage) {
      markdown += `## Usage\n\n`;
      for (const step of config.usage) {
        markdown += `${step}\n`;
      }
      markdown += `\n`;
    }

    // Features
    if (config.features) {
      markdown += `## Features\n\n`;
      for (const feature of config.features) {
        markdown += `- ${feature}\n`;
      }
      markdown += `\n`;
    }

    // API Documentation link
    if (config.apiDocs) {
      markdown += `## API Documentation\n\n`;
      markdown += `See [API Documentation](${config.apiDocs}) for detailed endpoint information.\n\n`;
    }

    // Contributing
    if (config.contributing) {
      markdown += `## Contributing\n\n`;
      markdown += `${config.contributing}\n\n`;
    }

    // License
    if (config.license) {
      markdown += `## License\n\n`;
      markdown += `${config.license}\n\n`;
    }

    return markdown;
  }

  /**
   * Generate quick reference
   */
  generateQuickRef(items: { command: string; description: string }[]): string {
    let markdown = `# Quick Reference\n\n`;
    markdown += `| Command | Description |\n`;
    markdown += `|---------|-------------|\n`;

    for (const item of items) {
      markdown += `| \`${item.command}\` | ${item.description} |\n`;
    }

    markdown += `\n`;
    return markdown;
  }

  /**
   * Save documentation to file
   */
  saveDoc(filename: string, content: string): void {
    const filepath = path.join(this.outputDir, filename);
    
    try {
      fs.writeFileSync(filepath, content, 'utf-8');
      logBoth('info', `[DocGen] Saved documentation to ${filepath}`);
    } catch (error) {
      logBoth('error', `[DocGen] Error saving documentation: ${error}`);
    }
  }

  /**
   * Generate full documentation set
   */
  generateFullDocs(config: {
    apiEndpoints: APIEndpoint[];
    modules: ModuleDoc[];
    readme: Parameters<DocGenerator['generateREADME']>[0];
  }): void {
    // Generate API documentation
    const apiDoc = this.generateAPIDoc(config.apiEndpoints);
    this.saveDoc('API.md', apiDoc);

    // Generate module documentation
    for (const module of config.modules) {
      const moduleDoc = this.generateModuleDoc(module);
      this.saveDoc(`${module.name}.md`, moduleDoc);
    }

    // Generate README
    const readme = this.generateREADME(config.readme as Parameters<typeof this.generateREADME>[0]);
    this.saveDoc('README.md', readme);

    logBoth('info', `[DocGen] Generated full documentation set (${config.modules.length + 2} files)`);
  }

  /**
   * Get documentation summary
   */
  getSummary(): string {
    const files = fs.readdirSync(this.outputDir).filter(f => f.endsWith('.md'));
    
    return `
Documentation Summary
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Output Directory: ${this.outputDir}
Generated Files: ${files.length}

Files:
${files.map(f => `  - ${f}`).join('\n')}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
    `.trim();
  }
}

// Export singleton instance
export const docGenerator = new DocGenerator();

/**
 * Helper: Generate API documentation
 */
export function generateAPIDoc(endpoints: APIEndpoint[], title?: string): string {
  return docGenerator.generateAPIDoc(endpoints, title);
}

/**
 * Helper: Generate module documentation
 */
export function generateModuleDoc(module: ModuleDoc): string {
  return docGenerator.generateModuleDoc(module);
}

/**
 * Helper: Save documentation
 */
export function saveDoc(filename: string, content: string): void {
  docGenerator.saveDoc(filename, content);
}
