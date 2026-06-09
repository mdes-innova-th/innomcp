import { NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

// Helper to execute terminal command
function execCommand(cmd: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    exec(cmd, { shell: "powershell.exe" }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout || "",
        stderr: stderr || "",
        code: error ? (error.code || 1) : 0
      });
    });
  });
}

// Check if tmux session exists
async function checkTmuxSession(sessionName: string): Promise<boolean> {
  // Try running tmux has-session (works if tmux is in PATH/Git Bash)
  try {
    const { code } = await execCommand(`bash -c "tmux has-session -t ${sessionName}"`);
    return code === 0;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const isRunning = await checkTmuxSession("innova");
    return NextResponse.json({
      session: "innova",
      isRunning,
      timestamp: Date.now()
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to check status" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || "status";
    const scriptPath = "C:/Users/USER-NT/Jit/scripts/tmux-multiagent.sh";

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: `Script not found at: ${scriptPath}` }, { status: 404 });
    }

    let command = "";
    if (action === "start") {
      // Run in background (nohup / fork) to avoid blocking the API response
      command = `bash -c "nohup "${scriptPath}" > /dev/null 2>&1 &"`;
    } else if (action === "stop") {
      command = `bash -c ""${scriptPath}" stop"`;
    } else if (action === "auto-heal") {
      command = `bash -c "python -m innova_bot.gui.rpg_tui --heal"`; // mock or auto-heal command
    } else if (action === "run-tests") {
      command = `bash -c "pytest C:/Users/USER-NT/DEV/innova-bot-template/devtools/innova-bot/tests/test_rpg_tui.py"`;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { stdout, stderr, code } = await execCommand(command);

    return NextResponse.json({
      action,
      success: code === 0,
      code,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Execution failed" }, { status: 500 });
  }
}
