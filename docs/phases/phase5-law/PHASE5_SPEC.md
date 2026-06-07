# Phase 5: Thai Law & Culture

## 🎯 Goal

Enable AI to answer questions about Thai Law (Royal Gazette) and Religion/Culture (Buddhism/Temples) with high accuracy and cultural sensitivity.

## 📦 Scope

1.  **Thai Law (`thai_law_tool`)**
    - **Domain**: `LAW`
    - **Entities**: `LAW_ACT` (พ.ร.บ.), `LAW_SECTION` (มาตรา), `LAW_CATEGORY`.
    - **Source**: Royal Gazette (simulated), Key Acts (Criminal, Civil, Computer Crime).
    - **Function**: Search by keyword, get specific section, summarize law.

2.  **Thai Religion & Culture (`thai_religion_tool`)**
    - **Domain**: `RELIGION`
    - **Entities**: `RELIGION_PLACE` (วัด), `RELIGION_PERSON` (พระเกจิ), `RELIGION_CONCEPT` (วันสำคัญ).
    - **Source**: TAT, Wikipedia, ONAB.
    - **Function**: Search temples, find holy days, explain concepts.

## 🏗️ Architecture

- **Knowledge DB**: Expand `THAI_KNOWLEDGE_DB` with `LAW` and `RELIGION` schemas.
- **Tools**:
  - `thai_law_tool`: Regex + Search.
  - `thai_religion_tool`: Keyword + Graph (e.g., Temple -> Province).

## 🧪 Definition of Done (DoD)

1.  **Schema**: `THAI_KNOWLEDGE_SCHEMA.json` supports Law & Religion.
2.  **Seed Data**:
    - Law: Computer Crime Act, Civil Code (partial).
    - Religion: 5 Major Temples (Wat Phra Kaew, etc.), 3 Important Days.
3.  **Tools**: Both tools registered and passing tests.
4.  **Accuracy**: Can answer "มาตรา 112 คืออะไร" and "วัดพระแก้วปิดกี่โมง".
