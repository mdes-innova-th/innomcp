<!-- cc-team deliverable
 group: P3A (Phase 3.1 â€” Fix fastPathHandler: greetings must pass to LLM, not get 'à¸«à¹‰à¸²à¸¡à¹€à¸”à¸²à¹‚à¸§à¹‰à¸¢')
 member: P3A-7 role=doc model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":64,"completion_tokens":2003,"total_tokens":2067,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":845,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 106s
 generated: 2026-06-12T03:43:23.608Z -->
# Fast Path Handler Greeting Fix / แก้ไขระบบตอบรับคำทักทาย

## 🐛 ปัญหาเดิม (The Problem)
ก่อนหน้านี้ Fast path handler มีปัญหาสับสนระหว่างคำทักทาย (greeting) กับคำที่ไม่เกี่ยวข้อง เช่น เวลาผู้ใช้พิมพ์ `"hello"` ระบบกลับตอบกลับด้วยข้อความปฏิเสธการสุ่มเดาอย่าง `"ห้ามเดาโว้ย"` แทนที่จะตอบสนองต่อคำทักทายอย่างถูกต้อง เกิดจากการที่ระบบขาดการตรวจสอบประเภทของคำ (token) ทำให้คำทักทายตกไปอยู่ใน logic ปฏิเสธ (rejection flow) ที่ผิดพลาด

Previously, the fast path handler misclassified inputs. Typing `"hello"` incorrectly triggered the fallback rejection response `"ห้ามเดาโว้ย"` (Don't guess!) instead of a proper greeting reply, because it lacked token differentiation.

## ✅ การแก้ไข (The Fix)
เราได้เพิ่มการตรวจสอบ `GREETING_TOKENS` เข้าไปใน fast path logic ตอนนี้ระบบจะตรวจสอบก่อนว่า input อยู่ในชุดคำทักทายหรือไม่ ถ้าใช่ จะวิ่งเข้าสู่ greeting flow โดยตรง ป้องกันไม่ให้คำทักทายหลุ��เข้าสู่ flow ปฏิเสธ

We added a `GREETING_TOKENS` check. The handler now verifies if the input token exists in the greeting set. If it matches, it routes to the greeting flow directly, preventing false rejections.

## ➕ วิธีเพิ่มคำทักทาย (How to Add More Greetings)
หากต้องการเพิ่มคำทักทายใหม่ ให้ไปที่ไฟล์ config ที่กำหนด `GREETING_TOKENS` แล้วเพิ่มคำลงไปใน set:

To add new greetings, simply append your new words to the `GREETING_TOKENS` collection:

```python
GREETING_TOKENS = {"hello", "hi", "สวัสดี", "หวัดดี"}
# Just add your new token string here!
```
