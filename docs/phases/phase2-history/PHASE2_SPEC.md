# Phase 2: Thai History Knowledge Specification

## 🎯 Goal

Enable AI to understand Thai history context, including Eras, Monarchs, Key Events, and Historical Figures.
Avoid "Foreigner Hallucination" (e.g., mixing up Kings or Eras).

## 🗂️ Scope

1.  **Domain**: `HISTORY`
2.  **Entity Types**:
    - `ERA` (e.g., Sukhothai, Ayutthaya, Rattanakosin)
    - `PERSON` (e.g., King Naresuan, Sunthorn Phu)
    - `EVENT` (e.g., Fall of Ayutthaya 2, Bowring Treaty)
3.  **MCP Tool**: `thai_history_tool`
4.  **Data Source**: Static Seed (Eras/Kings) + RAG (Events).

## 🏗️ Architecture Changes

### 1. `THAI_KNOWLEDGE_DB.md` Update

Add `HISTORY` domain attributes.

### 2. `THAI_KNOWLEDGE_SCHEMA.json` Update

Add `attributes` schema for History types.
