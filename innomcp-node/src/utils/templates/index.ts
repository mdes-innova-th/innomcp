/**
 * Response Templates Module
 * à¹à¸¡à¹ˆà¹à¸šà¸šà¸à¸²à¸£à¸•à¸­à¸šà¸à¸¥à¸±à¸šà¸ªà¸³à¸«à¸£à¸±à¸šà¸ªà¸–à¸²à¸™à¸à¸²à¸£à¸“à¹Œà¸•à¹ˆà¸²à¸‡à¹†
 * 
 * Features:
 * - Pre-defined response templates
 * - Multi-language templates
 * - Dynamic template rendering
 * - Template variables
 * 
 * @module utils/templates
 */

import { logBoth } from '../mcpLogger';

/**
 * Template Variables
 */
export interface TemplateVariables {
  [key: string]: string | number | boolean;
}

/**
 * Response Template
 */
export interface ResponseTemplate {
  id: string;
  category: 'weather' | 'time' | 'officeholder' | 'search' | 'error' | 'general';
  language: 'th' | 'en' | 'both';
  template: string;
  variables?: string[];
  examples?: TemplateVariables[];
}

/**
 * Template Manager
 */
class TemplateManager {
  private templates: Map<string, ResponseTemplate> = new Map();

  constructor() {
    this.loadDefaultTemplates();
  }

  /**
   * Load default templates
   */
  private loadDefaultTemplates(): void {
    // Weather templates
    this.register({
      id: 'weather.current',
      category: 'weather',
      language: 'th',
      template: 'à¸ªà¸ à¸²à¸žà¸­à¸²à¸à¸²à¸¨à¸—à¸µà¹ˆ {location} à¸•à¸­à¸™à¸™à¸µà¹‰ {condition} à¸­à¸¸à¸“à¸«à¸ à¸¹à¸¡à¸´ {temperature}Â°C à¸„à¸§à¸²à¸¡à¸Šà¸·à¹‰à¸™ {humidity}%',
      variables: ['location', 'condition', 'temperature', 'humidity']
    });

    this.register({
      id: 'weather.forecast',
      category: 'weather',
      language: 'th',
      template: 'à¸žà¸¢à¸²à¸à¸£à¸“à¹Œà¸­à¸²à¸à¸²à¸¨{period}: {forecast} à¸­à¸¸à¸“à¸«à¸ à¸¹à¸¡à¸´ {temp_min}-{temp_max}Â°C à¹‚à¸­à¸à¸²à¸ªà¸à¸™à¸•à¸ {rain_chance}%',
      variables: ['period', 'forecast', 'temp_min', 'temp_max', 'rain_chance']
    });

    this.register({
      id: 'weather.rain',
      category: 'weather',
      language: 'th',
      template: 'à¸à¸™à¸•à¸à¸—à¸µà¹ˆ {location} {intensity} à¹€à¸£à¸´à¹ˆà¸¡ {start_time} à¸¢à¸±à¸‡à¸„à¸‡à¸•à¸à¸­à¸µà¸ {duration}',
      variables: ['location', 'intensity', 'start_time', 'duration']
    });

    // Time templates
    this.register({
      id: 'time.current',
      category: 'time',
      language: 'th',
      template: 'à¸•à¸­à¸™à¸™à¸µà¹‰à¹€à¸§à¸¥à¸² {time} {timezone} à¸§à¸±à¸™à¸—à¸µà¹ˆ {date}',
      variables: ['time', 'timezone', 'date']
    });

    this.register({
      id: 'time.countdown',
      category: 'time',
      language: 'th',
      template: 'à¹€à¸«à¸¥à¸·à¸­à¸­à¸µà¸ {days} à¸§à¸±à¸™ {hours} à¸Šà¸±à¹ˆà¸§à¹‚à¸¡à¸‡ {minutes} à¸™à¸²à¸—à¸µ à¸ˆà¸™à¸–à¸¶à¸‡ {event}',
      variables: ['days', 'hours', 'minutes', 'event']
    });

    // Officeholder templates
    this.register({
      id: 'officeholder.current',
      category: 'officeholder',
      language: 'th',
      template: '{position}à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™à¸„à¸·à¸­ {name} à¸”à¸³à¸£à¸‡à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡à¸•à¸±à¹‰à¸‡à¹à¸•à¹ˆ {since}',
      variables: ['position', 'name', 'since']
    });

    this.register({
      id: 'officeholder.list',
      category: 'officeholder',
      language: 'th',
      template: 'à¸£à¸²à¸¢à¸Šà¸·à¹ˆà¸­{position}:\n{list}',
      variables: ['position', 'list']
    });

    // Search templates
    this.register({
      id: 'search.results',
      category: 'search',
      language: 'both',
      template: 'à¸žà¸š {count} à¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œà¸ªà¸³à¸«à¸£à¸±à¸š "{query}":\n{results}',
      variables: ['count', 'query', 'results']
    });

    this.register({
      id: 'search.no_results',
      category: 'search',
      language: 'th',
      template: 'à¹„à¸¡à¹ˆà¸žà¸šà¸œà¸¥à¸¥à¸±à¸žà¸˜à¹Œà¸ªà¸³à¸«à¸£à¸±à¸š "{query}" à¸¥à¸­à¸‡à¸„à¹‰à¸™à¸«à¸²à¸”à¹‰à¸§à¸¢à¸„à¸³à¸­à¸·à¹ˆà¸™à¸«à¸£à¸·à¸­à¸•à¸´à¸”à¸•à¹ˆà¸­à¸œà¸¹à¹‰à¸”à¸¹à¹à¸¥à¸£à¸°à¸šà¸š',
      variables: ['query']
    });

    // Error templates
    this.register({
      id: 'error.generic',
      category: 'error',
      language: 'th',
      template: 'à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”: {error} à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡',
      variables: ['error']
    });

    this.register({
      id: 'error.timeout',
      category: 'error',
      language: 'th',
      template: 'à¸à¸²à¸£à¸£à¹‰à¸­à¸‡à¸‚à¸­à¹ƒà¸Šà¹‰à¹€à¸§à¸¥à¸²à¸™à¸²à¸™à¹€à¸à¸´à¸™à¹„à¸› à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆà¸ à¸²à¸¢à¸«à¸¥à¸±à¸‡',
      variables: []
    });

    this.register({
      id: 'error.rate_limit',
      category: 'error',
      language: 'th',
      template: 'à¸„à¸¸à¸“à¸ªà¹ˆà¸‡à¸„à¸³à¸‚à¸­à¸¡à¸²à¸à¹€à¸à¸´à¸™à¹„à¸› à¸à¸£à¸¸à¸“à¸²à¸£à¸­ {wait_time} à¸§à¸´à¸™à¸²à¸—à¸µà¹à¸¥à¹‰à¸§à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆ',
      variables: ['wait_time']
    });

    // General templates
    this.register({
      id: 'general.greeting',
      category: 'general',
      language: 'th',
      template: 'à¸ªà¸§à¸±à¸ªà¸”à¸µà¸„à¸£à¸±à¸š {name} à¸¡à¸µà¸­à¸°à¹„à¸£à¹ƒà¸«à¹‰à¸Šà¹ˆà¸§à¸¢à¹„à¸«à¸¡à¸„à¸£à¸±à¸š?',
      variables: ['name']
    });

    this.register({
      id: 'general.help',
      category: 'general',
      language: 'th',
      template: 'à¸‰à¸±à¸™à¸ªà¸²à¸¡à¸²à¸£à¸–à¸Šà¹ˆà¸§à¸¢à¸„à¸¸à¸“à¹€à¸£à¸·à¹ˆà¸­à¸‡:\n- à¸ªà¸ à¸²à¸žà¸­à¸²à¸à¸²à¸¨à¹à¸¥à¸°à¸žà¸¢à¸²à¸à¸£à¸“à¹Œà¸­à¸²à¸à¸²à¸¨\n- à¹€à¸§à¸¥à¸²à¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™\n- à¸œà¸¹à¹‰à¸”à¸³à¸£à¸‡à¸•à¸³à¹à¸«à¸™à¹ˆà¸‡\n- à¸„à¹‰à¸™à¸«à¸²à¸‚à¹‰à¸­à¸¡à¸¹à¸¥\nà¸¥à¸­à¸‡à¸–à¸²à¸¡à¸­à¸°à¹„à¸£à¸à¹‡à¹„à¸”à¹‰à¹€à¸¥à¸¢!',
      variables: []
    });

    logBoth('info', `[Templates] Loaded ${this.templates.size} default templates`);
  }

  /**
   * Register template
   */
  register(template: ResponseTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get template
   */
  get(templateId: string): ResponseTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Render template
   */
  render(templateId: string, variables: TemplateVariables = {}): string {
    const template = this.templates.get(templateId);
    
    if (!template) {
      logBoth('warn', `[Templates] Template not found: ${templateId}`);
      return '';
    }

    let rendered = template.template;

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
    }

    // Check for missing variables
    const missingVars = rendered.match(/\{[^}]+\}/g);
    if (missingVars) {
      logBoth('warn', `[Templates] Missing variables in ${templateId}: ${missingVars.join(', ')}`);
    }

    return rendered;
  }

  /**
   * Get templates by category
   */
  getByCategory(category: ResponseTemplate['category']): ResponseTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.category === category);
  }

  /**
   * List all template IDs
   */
  list(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Get template summary
   */
  getSummary(): string {
    const categories = new Map<string, number>();
    
    for (const template of this.templates.values()) {
      categories.set(template.category, (categories.get(template.category) || 0) + 1);
    }

    const categorySummary = Array.from(categories.entries())
      .map(([cat, count]) => `  - ${cat}: ${count} templates`)
      .join('\n');

    return `
Template Summary
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
Total Templates: ${this.templates.size}

By Category:
${categorySummary}
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
    `.trim();
  }
}

// Export singleton instance
export const templates = new TemplateManager();

/**
 * Helper: Render template
 */
export function renderTemplate(templateId: string, variables?: TemplateVariables): string {
  return templates.render(templateId, variables);
}

/**
 * Helper: Get template
 */
export function getTemplate(templateId: string): ResponseTemplate | undefined {
  return templates.get(templateId);
}

/**
 * Helper: List templates
 */
export function listTemplates(): string[] {
  return templates.list();
}
