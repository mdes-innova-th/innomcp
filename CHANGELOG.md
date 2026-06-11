```markdown
# CHANGELOG

## [10.17.0] — 2026-06-11

### Added
Complete Manus.ai-style redesign of INNOMCP:

**Layout & UI**
- MDESBrandHeader: MDES government branding, provider toggle, workspace toggle, model picker, settings ⚙️
- ManusWorkspacePanel: 3-tab workspace (งาน/เว็บ/Terminal/ไฟล์ผลลัพธ์)
- CollapsibleAgentWrapper: MultiAgentPanel collapsed by default
- ChatEmptyStateManager: Manus-style empty state orchestration
- ChatWelcomeHero: INNOMCP hero section with MDES branding
- GovernmentQuickActions: Thai government quick action shortcuts
- AgentStepsView: Step-by-step agent tracker (Manus computer style)

**Chat Components** (30+ new)
- MDESChatBubble, FollowUpSuggestions, MDESCodeBlock, MDESTableRenderer
- MDESWeatherCard, MDESMapCard, MDESDocumentCard, MDESEvidenceCard
- SlashCommandMenu, ComposerEnhancedBar, InlineFeedbackBar
- ChatConversationHeader, ProviderStatusBar, ChatStickyActions

**Provider Management**
- ProviderModal: 8 preset providers (MDES, OpenAI, Anthropic, Groq, Gemini, Ollama, LMStudio, ThaiLLM)
- MDESModelPicker: Live MDES Ollama model picker
- INNOMCPSettingsPanel: Full settings panel

**Backend (innomcp-node)**
- WorkspaceService: Innova-workspace file management
- AnalyticsService: Real-time usage tracking
- MDESModelCache: Ollama model list cache
- ThaiNLPService: Thai intent detection + entity extraction
- New API routes: /workspace, /analytics, /mdes/*, /thai/nlp

**PWA & Accessibility**
- manifest.json, PWAInstallPrompt
- ARIALiveRegion, FocusManager, SkipNavigation
- MDESThemeProvider, MDESThemeSwitcher

**Testing**
- 8 unit test files (Jest + @testing-library)
- 3 Playwright E2E specs

**Documentation**
- API Reference, Deployment Guide, Security Guide
- Thai Government Integration Guide, Component Guide

### Changed
- ChatPage.tsx: 3-column Manus layout
- StarterPromptsGrid: 8 prompts + government quick actions
- globals.css: MDES brand tokens + Manus animations
```