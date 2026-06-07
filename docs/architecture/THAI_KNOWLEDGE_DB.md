````md
# Thai Knowledge Database – INNOMCP

## Purpose

ฐานข้อมูลความรู้ไทย สำหรับให้ AI

- เข้าใจบริบทจริง
- เลือก MCP tool ได้ถูก
- ไม่ hallucinate

---

## Core Concepts

### Knowledge Entity

ความรู้ 1 หน่วย = 1 Entity  
เช่น จังหวัด / กฎหมาย / วัด / บุคคล / เหตุการณ์

---

## Entity Structure (Logical)

| Field       | Description                                      |
| ----------- | ------------------------------------------------ |
| id          | unique id                                        |
| domain      | geo / law / history / religion / education       |
| type        | province / district / subdistrict / law / temple |
| name_th     | ชื่อหลักภาษาไทย                                  |
| aliases     | ชื่อเรียกอื่น / ชื่อเก่า (JSON Array)            |
| description | คำอธิบายสั้น กระชับ                              |
| attributes  | ข้อมูลเฉพาะ domain (JSON Object)                 |
| relations   | ความสัมพันธ์กับ entity อื่น (JSON Object)        |
| source      | แหล่งข้อมูล (JSON Array of Objects)              |
| confidence  | 0.0 – 1.0                                        |
| version     | semantic version                                 |
| updated_at  | ISO datetime                                     |

---

## Domain-Specific Attributes

### GEO

```json
{
  "province": "นครราชสีมา",
  "district": "เมือง",
  "region": "อีสาน",
  "lat": 14.9799,
  "lon": 102.0977
}
```
````

### LAW

```json
{
  "law_type": "พระราชบัญญัติ",
  "status": "active",
  "effective_date": "2018-01-01",
  "applies_to": ["ประชาชน", "หน่วยงานรัฐ"]
}
```

### RELIGION

```json
{
  "type": "วัด",
  "sect": "เถรวาท",
  "location": "กรุงเทพมหานคร"
}
```

---

## Relation Types

- located_in
- related_to
- governed_by
- historical_event
- commonly_confused_with

---

## Update Policy

- ทุก record ต้องมี source
- confidence < 0.6 → ห้ามใช้ตัดสินใจลำพัง
- version bump ทุกครั้งที่แก้ content

```

```
