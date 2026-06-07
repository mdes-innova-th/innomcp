# Quick Start Script for Ollama + Docker Project

## Windows PowerShell Script

save this as `start-ollama-and-docker.ps1`:

```powershell
# ============================================
# Start Ollama and Docker for InnoMCP Project
# ============================================

Write-Host "🚀 Starting InnoMCP Project with Local Ollama" -ForegroundColor Cyan

# Step 1: Check if Ollama is running
Write-Host "`n1️⃣  Checking Ollama Service..." -ForegroundColor Yellow
$ollamaRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -ErrorAction Stop
    $ollamaRunning = $true
    Write-Host "✅ Ollama is running on port 11434" -ForegroundColor Green
    
    $models = $response.Content | ConvertFrom-Json
    Write-Host "📦 Available Models: $($models.models.name -join ', ')" -ForegroundColor Green
} catch {
    Write-Host "❌ Ollama is NOT running" -ForegroundColor Red
    Write-Host "   Please start Ollama first by running: ollama serve" -ForegroundColor Yellow
    $ollamaRunning = $false
}

if (-not $ollamaRunning) {
    Write-Host "`n⏳ Waiting for Ollama to start..." -ForegroundColor Cyan
    Write-Host "   📌 Run this in another terminal: ollama serve" -ForegroundColor Yellow
    Write-Host "   Press Enter when Ollama is running..." -ForegroundColor Cyan
    Read-Host
}

# Step 2: Check Docker Desktop
Write-Host "`n2️⃣  Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "✅ $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is NOT installed or not running" -ForegroundColor Red
    Write-Host "   Please install Docker Desktop from https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Step 3: Navigate to project directory
Write-Host "`n3️⃣  Navigating to project..." -ForegroundColor Yellow
$projectPath = "C:\Users\USER-NT\DEV\innomcp"
if (Test-Path $projectPath) {
    Set-Location $projectPath
    Write-Host "✅ In project directory: $projectPath" -ForegroundColor Green
} else {
    Write-Host "❌ Project directory not found: $projectPath" -ForegroundColor Red
    exit 1
}

# Step 4: Stop and remove old containers
Write-Host "`n4️⃣  Cleaning up old containers..." -ForegroundColor Yellow
try {
    docker compose down 2>&1 | Out-Null
    Write-Host "✅ Old containers removed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  No containers to remove" -ForegroundColor Yellow
}

# Step 5: Build and start new containers
Write-Host "`n5️⃣  Building and starting Docker containers..." -ForegroundColor Yellow
Write-Host "   (This may take a few minutes...)" -ForegroundColor Cyan
docker compose up --build

Write-Host "`n✅ Project started successfully!" -ForegroundColor Green
Write-Host "`n📋 Services running:" -ForegroundColor Cyan
Write-Host "   🌐 Frontend: http://localhost:3004" -ForegroundColor Green
Write-Host "   🔌 API: http://localhost:3010" -ForegroundColor Green
Write-Host "   🛠️  MCP Server: http://localhost:3011" -ForegroundColor Green
Write-Host "   💾 Database: localhost:3306" -ForegroundColor Green
Write-Host "   🔴 Redis: localhost:6379" -ForegroundColor Green
Write-Host "   🤖 Ollama: http://localhost:11434" -ForegroundColor Green
```

## วิธีใช้:

1. **สร้างไฟล์ script** ใน `C:\Users\USER-NT\DEV\innomcp\start-ollama-and-docker.ps1`

2. **ทำให้สามารถเรียกใช้ได้**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

3. **เปิด PowerShell แล้วรัน**:
```powershell
cd C:\Users\USER-NT\DEV\innomcp
.\start-ollama-and-docker.ps1
```

---

## Manual Steps (ถ้าไม่ใช้ script)

### Terminal 1: เปิด Ollama
```powershell
ollama serve
# ถ้ามีปัญหา ลองสั่ง: C:\Users\USER-NT\AppData\Local\Programs\Ollama\ollama serve
```

### Terminal 2: เปิด Docker
```powershell
cd C:\Users\USER-NT\DEV\innomcp
docker compose down
docker compose up --build
```

---

## ทดสอบระบบ

### ตรวจสอบ Ollama API
```powershell
curl http://localhost:11434/api/tags
# ควรแสดง models ที่ถูก download
```

### ตรวจสอบ Docker Connectivity
```powershell
docker exec innomcp-node curl -v http://host.docker.internal:11434/api/tags
# ถ้าเห็นรายการ models = Docker สามารถเชื่อมต่อ Ollama ได้
```

### ตรวจสอบ Chat API
```powershell
# ใช้เบราว์เซอร์เปิด: http://localhost:3004
# ลองพิมพ์ข้อความใน chat
# ถ้าได้ response = สำเร็จ!
```
