# การสร้างเครื่องมือ (Tool Authoring)

## การสร้างเครื่องมือใหม่ที่ implement uniform interface

- สร้างคลาสที่สืบทอดจาก `BaseTool` หรือ implement interface ที่กำหนด
- ต้องมีเมธอด `execute(params)` ซึ่งรับ `dict` และคืนค่า `dict` ตามรูปแบบที่ตกลงกัน
- กำหนด metadata เช่น `name`, `description`, `parameters` (schema) เพื่อให้ agent รู้จัก

```python
class MyTool(BaseTool):
    name = "my_tool"
    description = "Does something"
    parameters = {
        "type": "object",
        "properties": {
            "input": {"type": "string"}
        }
    }
    async def execute(self, params: dict) -> dict:
        result = do_something(params["input"])
        return {"output": result}
```

## การลงทะเบียนและให้ agent loop ค้นพบ

- ลงทะเบียนเครื่องมือใน registry ส่วนกลาง (เช่น `ToolRegistry.register(MyTool())`)
- หรือใช้ decorator `@tool` เพื่อ auto-register
- agent loop จะ scan registry และเพิ่ม tool metadata ใน system prompt
- หากเป็น plugin system ให้วางไฟล์ในโฟลเดอร์ที่กำหนด ระบบจะโหลดอัตโนมัติ

```python
ToolRegistry.register(MyTool())
```

## กฎความปลอดภัย

### codeExec timeout
- กำหนด timeout สูงสุดสำหรับการรันโค้ด (เช่น 30 วินาที)
- ใช้ `asyncio.wait_for` หรือ `subprocess timeout`
- หากเกินเวลา ยกเลิกและคืน error

```python
try:
    result = await asyncio.wait_for(exec_code(params), timeout=30)
except asyncio.TimeoutError:
    return {"error": "Execution timeout"}
```

### file traversal guards
- ห้ามเข้าถึงไฟล์นอก working directory ที่อนุญาต
- ใช้ path sanitization: แปลง path เป็น absolute แล้วตรวจสอบว่าเริ่มต้นด้วย allowed base path
- ปฏิเสธ path ที่มี `../` หรือ symlink นอกขอบเขต

```python
from pathlib import Path
BASE_DIR = Path("/allowed/dir")
user_path = Path(params["path"]).resolve()
if not str(user_path).startswith(str(BASE_DIR)):
    raise PermissionError("Access denied")
```
