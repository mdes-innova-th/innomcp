# Tool: Thai Law Tool

## 📌 Purpose

Access Thai legal information, specifically Royal Gazette announcements and key codes (Criminal, Civil, Computer Crime).

## 📥 Input Schema

```typescript
type ThaiLawInput = {
  query: string; // e.g., "PDPA", "มาตรา 112", "พรบ. คอมพิวเตอร์"
  type?: "search" | "section_lookup" | "summary";
  law_name?: string; // Optional filter by specific law
  section_no?: string; // Optional specific section
};
```

## 📤 Output Schema

```typescript
type ThaiLawOutput = {
  content: Array<{
    type: "text";
    text: string;
    metadata?: {
      law_id: string;
      law_name: string;
      section?: string;
      status: "active" | "revoked";
      link?: string;
    };
  }>;
};
```

## 🧠 Logic

1.  **Section Lookup**: If `section_no` provided, finding exact match in seeded DB.
2.  **Search**: Fuzzy match on law names and keywords.
3.  **Safety**: For sensitive laws, return _exact text only_ without interpretation/opinion.
