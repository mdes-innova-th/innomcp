| var | scope | dev value | docker value | secret? | notes |
| --- | --- | --- | --- | --- | --- |
| NEXT_PUBLIC_BACKEND_URL | both (build-time baked) | `http://localhost:3000/api` | `http://backend:3000/api` | No | ตัวแปรที่ใช้ใน client และต้องถูกฝังใน build time |
| NEXT_PUBLIC_WS_URL | both (build-time baked) | `ws://localhost:3000/ws` | `ws://backend:3000/ws` | No | WebSocket URL ฝั่ง client ต้องกำหนดตอน build |
| NODE_BACKEND_HOST | runtime | `localhost` | `backend` | No | โฮสต์ของ Node.js backend (ไม่ใช่ public) |
| DB_HOST | runtime | `localhost` | `mariadb` | No | โฮสต์ของ MariaDB |
| DB_PORT | runtime | `3308` | `3308` | No | พอร์ตของ MariaDB |
| DB_NAME | runtime | `innomcp` | `innomcp` | No | ชื่อฐานข้อมูล |
| DB_USER | runtime | `root` | `innomcp_user` | No | ชื่อผู้ใช้ฐานข้อมูล |
| DB_PASSWORD | runtime | `password` | `userpass` | Yes | รหัสผ่านของผู้ใช้ฐานข้อมูล |
| MARIADB_ROOT_PASSWORD | docker | `rootpass` | `rootpass` | Yes | รหัสผ่าน root ของ MariaDB container |
| MARIADB_DATABASE | docker | `innomcp` | `innomcp` | No | ชื่อฐานข้อมูลสำหรับ Docker |
| MARIADB_USER | docker | `innomcp_user` | `innomcp_user` | No | ชื่อผู้ใช้สำหรับ Docker |
| MARIADB_PASSWORD | docker | `userpass` | `userpass` | Yes | รหัสผ่านผู้ใช้ MariaDB |
| REDIS_URL | runtime | `redis://localhost:6379` | `redis://redis:6379` | No | URL สำหรับเชื่อมต่อ Redis |
| OLLAMA_URL | runtime | `http://localhost:11434` | `http://ollama:11434` | No | URL ของ Ollama server |
| COMMANDCODE_API_KEY | runtime | `your-api-key` | `your-api-key` | Yes | API Key สำหรับ CommandCode |
| JWT_SECRET | runtime | `your-secret` | `your-secret` | Yes | Secret สำหรับ JWT token |
| INNOMCP_MODE | runtime | `development` | `production` | No | โหมดการทำงาน (dev/prod) |
