# Tool: Thai Religion Tool

## 📌 Purpose

Provide information on Thai Buddhism, Temples, Monks, and Cultural Traditions.

## 📥 Input Schema

```typescript
type ThaiReligionInput = {
  query: string; // e.g., "วัดพระแก้ว", "วันวิสาขบูชา", "หลวงพ่อคูณ"
  type?: "place" | "person" | "concept" | "calendar";
  province?: string; // Filter by location
};
```

## 📤 Output Schema

```typescript
type ThaiReligionOutput = {
  content: Array<{
    type: "text";
    text: string;
    metadata?: {
      name: string;
      category: "temple" | "monk" | "tradition";
      location?: string;
      significance?: string;
    };
  }>;
};
```

## 🧠 Logic

1.  **Temple Search**: Match name + province.
2.  **Calendar**: Calculate lunar dates for major holidays (Visakha Bucha, etc.).
3.  **Tone**: Ensure respectful language options.
