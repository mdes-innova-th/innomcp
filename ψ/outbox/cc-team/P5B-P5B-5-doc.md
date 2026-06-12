<!-- cc-team deliverable
 group: P5B (Phase 5.3 â€” Wave policy doc + overall recovery summary)
 member: P5B-5 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":67,"completion_tokens":5612,"total_tokens":5679,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":4378,"image_tokens":0},"cache_creation_input_tokens":0} | 103s
 generated: 2026-06-12T03:48:44.354Z -->
# POSTMORTEM-MEGA100: Ingestion Layer Cascading Failure

## Summary
On October 24, the MEGA100 data ingestion layer in the us-east-1 region suffered a complete outage lasting 4 hours and 12 minutes. A severe memory leak in the v2.4 JSON parser, combined with an overly aggressive auto-scaling policy, completely exhausted cluster resources and crashed the Kubernetes control plane.
**สรุป:** เมื่อวันที่ 24 ตุลาคม ระบบรับข้อมูล MEGA100 ในภูมิภาค us-east-1 ล่มทั้งหมดเป็นเวลา 4 ชั่วโมง 12 นาที หน่วยความจำรั่วไหลอย่างรุนแรงใน JSON parser v2.4 ประกอบกับนโยบายการขยายระบบอัตโนมัติที่รุนแรงเกินไป ทำให้ทรัพยากรคลัสเตอร์หมดลงและระนาบควบคุมของ Kubernetes ล่ม

## Impact
Approximately 1.5 million API requests failed with 503 Service Unavailable errors. 45 enterprise clients experienced critical data sync delays, resulting in SLA breaches. Customer support received over 800 tickets. Estimated revenue loss and penalty payouts total $120,000.
**ผลกระทบ:** คำขอ API ประมาณ 1.5 ล้านรายการล้มเหลวด้วยข้อผิดพลาด 503 ลูกค้าองค์กร 45 รายประสบปัญหาการซิงค์ข้อมูลล่าช้า ส่งผลให้ผิดข้อตกลง SLA ฝ่ายสนับสนุนลูกค้าได้รับตั๋วมากกว่า 800 รายการ ความเสียหายและค่าปรับโดยประมาณรวม 120,000 ดอลลาร์

## Timeline (UTC)
* **10:00** - v2.4 parser deployed to production. / ปรับใช้ parser v2.4 ขึ้นระบบจริง
* **10:45** - Memory usage spikes to 95% across ingestion nodes. / การใช้หน่วยความจำพุ่งสูงถึง 95% ทั่วทั้งโหนด
* **11:00** - Auto-scaler adds 50 nodes, causing VPC network saturation. / Auto-scaler เพิ่ม 50 โหนด ทำให้เครือข่าย VPC อิ่มตัว
* **11:15** - Complete Kubernetes control plane failure due to API rate limits. / ระนาบควบคุม Kubernetes ล้มเหลวทั้งหมดจากขีดจำกัดอัตรา API
* **14:12** - Rollback to v2.3 completed; services fully restored. / ย้อนกลับเป็น v2.3 เสร็จสิ้น ระบบกู้คืนเต็มที่

## Root Cause
A memory leak in the new `fast-json-parse v3.1` library caused continuous Out-Of-Memory (OOM) crashes. The auto-scaler misinterpreted these pod crashes as high traffic load, infinitely provisioning new nodes until the cloud provider API rate limits were hit and the Kubernetes API server was overwhelmed.
**��าเหตุหลัก:** หน่วยความจำรั่วไหลในไลบรารี `fast-json-parse v3.1` ใหม่ทำให้เกิดข้อผิดพลาด OOM ต่อเนื่อง ระบบ auto-scaler เข้าใจผิดว่าข้อผิดพลาดเหล่านี้คือปริมาณการใช้งานสูง จึงเพิ่มโหนดใหม่อย่างไม่จำกัดจนแตะขีดจำกัดอัตรา API ของผู้ให้บริการคลาวด์ และเซิร์ฟเวอร์ API ของ Kubernetes ล้มเหลว

## Contributing Factors
1. Missing hard memory limits in Kubernetes pod specifications. / ไม่มีการจำกัดหน่วยความจำแบบเข้มงวดในสเปค pod ของ Kubernetes
2. The auto-scaler configuration lacked a maximum node boundary. / การตั้งค่า auto-scaler ไม่มีขีดจำกัดจำนวนโหนดสูงสุด
3. Inadequate soak testing for the v2.4 release candidate. / การทดสอบระยะยาวสำหรับ v2.4 ไม่เพียงพอ
4. Alert fatigue masked the initial OOM warning notifications. / ความล้าจากการแจ้งเตือนปิดบังคำเตือน OOM เบื้องต้น
5. Manual rollback runbooks were outdated and slow to execute. / คู่มือการย้อนกลับด้วยตนเองล้าสมัยและดำเนินการช้า

## Action Items
* [ ] Enforce strict memory limits and requests on all ingestion pods. (Owner: DevOps) / บังคับใช้ขีดจำกัดหน่วยความจำกับ pod ทั้งหมด (เจ้าของ: DevOps)
* [ ] Cap auto-scaler maximum nodes to 120% of baseline. (Owner: SRE) / จำกัดโหนดสูงสุดของ auto-scaler ที่ 120% (เจ้าของ: SRE)
* [ ] Automate rollback pipelines for MEGA100 core services. (Owner: CI/CD) / สร้างไปป์ไลน์ย้อนกลับอัตโนมัติ (เจ้าของ: CI/CD)
* [ ] Implement PagerDuty alert grouping to reduce noise. (Owner: SRE) / ใช้การจัดกลุ่มการแจ้งเตือนเพื่อลดสัญญาณรบกวน (เจ้าของ: SRE)

## Lessons Learned
1. Resource boundaries are mandatory to prevent cascading failures. / ขอบเขตทรัพยากรเป็นสิ่งจำเป็นเพื่อป้องกันความล้มเหลวแบบลูกโซ่
2. Auto-scaling mechanisms require strict upper limits to protect control planes. / กลไกการขยายระบบต้องมีขีดจำกัดสูงสุดเพื่อปกป้องระนาบควบคุม
3. Load tests must explicitly simulate memory leaks and OOM kills. / การทดสอบโหลดต้องจำลองการรั่วไหลของหน่วยความจำอย่างชัดเจน
4. Alert routing needs dynamic severity tuning to prevent fatigue. / การกำหนดเส้นทางแจ้งเตือนต้องปรับความรุนแรงเพื่อป้องกันความล้า
5. Emergency runbooks must be tested and updated quarterly. / ต้องทดสอบและอัปเดตคู่มือฉุกเฉินทุกไตรมาส

## Prevention
Moving forward, all MEGA100 deployments require chaos engineering validation before production release. We will implement OOM-kill circuit breakers to halt scaling during crash loops, mandate strict peer reviews for infrastructure-as-code, and enforce canary deployments for all parser updates.
**การป้องกัน:** ต่อจากนี้ การปรับใช้ MEGA100 ทั้งหมดต้องผ่านการตรวจสอบ chaos engineering ก่อนขึ้นระบบจริง เราจะนำ circuit breakers สำหรับ OOM-kill มาใช้เพื่อหยุดการขยายระบบระหว่างเกิด crash loop บังคับให้ตรวจสอบ infrastructure-as-code อย่างเข้มงวด และใช้ canary deployments สำหรับการอัปเดต parser ทั���งหมด
