import subprocess
import time
import datetime
import sys
import threading
import os
import signal
import io

# Force UTF-8 for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# --- CONFIGURATION ---
TEST_COMMAND = ["npx", "jest", "tests/weather_regression_phase65_final.test.ts"]  # Target specific regression suite
MAX_DURATION_SECONDS = 6 * 3600  # 6 Hours
IDLE_TIMEOUT_SECONDS = 10 * 60   # 10 Minutes
RETRY_DELAY_SECONDS = 10         # Delay before retrying after failure
MAX_RETRIES = 1000               # Effective infinite retries for 6h duration

LOG_FILE = "antigravity_session.log"
REPORT_FILE = "summary_report.md"

# --- GLOBAL STATE ---
start_time = time.time()
running = True
last_output_time = time.time()
process = None
passed_specs = []
failed_specs = []
stuck_events = 0
restarts = 0

def log(message):
    """Writes to console and log file with timestamp."""
    timestamp = datetime.datetime.now().strftime("[%Y-%m-%d %H:%M:%S]")
    line = f"{timestamp} {message}"
    print(line)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")

# --- LOG CLEANER THREAD ---
class LogCleaner(threading.Thread):
    def __init__(self, filepath, max_lines=5000, check_interval=30):
        super().__init__()
        self.filepath = filepath
        self.max_lines = max_lines
        self.check_interval = check_interval
        self.daemon = True
        self.stop_event = threading.Event()

    def run(self):
        log(f"🧹 LogCleaner started. Monitoring {self.filepath} (Max: {self.max_lines} lines)")
        while not self.stop_event.is_set():
            try:
                self.clean()
            except Exception as e:
                log(f"⚠️ LogCleaner error: {e}")
            
            self.stop_event.wait(self.check_interval)

    def clean(self):
        if not os.path.exists(self.filepath):
            return

        try:
            # Check size first to avoid reading small files
            if os.path.getsize(self.filepath) < 1024 * 1024: # < 1MB
                return

            with open(self.filepath, "r", encoding="utf-8", errors='ignore') as f:
                lines = f.readlines()

            if len(lines) > self.max_lines:
                # Keep last 50%
                keep_count = int(self.max_lines * 0.5)
                new_lines = lines[-keep_count:]
                
                with open(self.filepath, "w", encoding="utf-8") as f:
                    f.writelines(new_lines)
                
                log(f"🧹 Log cleaned: Reduced from {len(lines)} to {len(new_lines)} lines.")
        except Exception as e:
            # Don't log here to avoid infinite loop if logging fails
            print(f"Log clean error: {e}")

    def stop(self):
        self.stop_event.set()

log_cleaner = None

def generate_report():
    """Generates the final markdown report."""
    duration = time.time() - start_time
    hours = int(duration // 3600)
    minutes = int((duration % 3600) // 60)
    
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(f"# 🛡️ Antigravity Watcher Report\n\n")
        f.write(f"**Date:** {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**Total Duration:** {hours}h {minutes}m\n\n")
        f.write(f"## 📊 Statistics\n")
        f.write(f"- **Passed Specs:** {len(passed_specs)}\n")
        f.write(f"- **Failed Specs:** {len(failed_specs)}\n")
        f.write(f"- **Stuck/Idle Events:** {stuck_events}\n")
        f.write(f"- **Runner Restarts:** {restarts}\n\n")
        
        f.write("## ❌ Failed Specs\n")
        if not failed_specs:
            f.write("_No failures detected._\n")
        else:
            for spec in failed_specs:
                f.write(f"- `{spec}`\n")
        
        f.write("\n## ✅ Passed Specs (Sample)\n")
        for spec in passed_specs[-10:]: # Show last 10
            f.write(f"- `{spec}`\n")
            
    log(f"Report generated: {REPORT_FILE}")

def signal_handler(sig, frame):
    """Handles Ctrl+C gracefully."""
    global running
    log("⚠️ Interrupt received. Shutting down gracefully...")
    running = False

signal.signal(signal.SIGINT, signal_handler)

def stream_reader(pipe, prefix):
    """Reads stdout/stderr in a thread."""
    global last_output_time
    for line in iter(pipe.readline, b''):
        last_output_time = time.time()
        decoded_line = line.decode('utf-8', errors='replace').strip()
        if decoded_line:
            # Detect Pass/Fail (Adjust regex for your specific runner output)
            if "PASS" in decoded_line:
                # spec_name = ... extract if possible
                passed_specs.append(decoded_line)
            if "FAIL" in decoded_line:
                 # spec_name = ... extract if possible
                failed_specs.append(decoded_line)
                
            log(f"[{prefix}] {decoded_line}")
    pipe.close()

def run_tests():
    global process, last_output_time, restarts, log_cleaner
    
    # Start LogCleaner
    log_cleaner = LogCleaner(LOG_FILE)
    log_cleaner.start()
    
    while running:
        # Check total duration
        # rotate_log() -> Removed, handled by thread
        
        if time.time() - start_time > MAX_DURATION_SECONDS:
            log("🛑 6-Hour Time Limit Reached. Stopping.")
            break

        log(f"🚀 Starting Test Runner: {' '.join(TEST_COMMAND)}")
        last_output_time = time.time()
        
        try:
            # Start process
            if sys.platform == "win32":
                process = subprocess.Popen(TEST_COMMAND, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True)
            else:
                process = subprocess.Popen(TEST_COMMAND, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

            # Start monitoring threads
            t_out = threading.Thread(target=stream_reader, args=(process.stdout, "OUT"))
            t_err = threading.Thread(target=stream_reader, args=(process.stderr, "ERR"))
            t_out.daemon = True
            t_err.daemon = True
            t_out.start()
            t_err.start()

            # Monitor loop
            while process.poll() is None and running:
                # Check idle timeout
                if time.time() - last_output_time > IDLE_TIMEOUT_SECONDS:
                    log(f"💤 Idle detected (> {IDLE_TIMEOUT_SECONDS/60} mins). Restarting runner...")
                    global stuck_events
                    stuck_events += 1
                    process.kill()
                    break # Break inner loop to restart
                
                # Check total duration in loop
                if time.time() - start_time > MAX_DURATION_SECONDS:
                    log("🛑 6-Hour Limit during execution. Killing process.")
                    process.terminate()
                    break

                time.sleep(1) # Prevent high CPU usage

            # Process finished
            exit_code = process.poll()
            if exit_code is not None:
                log(f"🏁 Runner exited with code {exit_code}")
                if exit_code != 0:
                    log(f"⚠️ Test failure or crash. Waiting {RETRY_DELAY_SECONDS}s before retry...")
                    restarts += 1
                    if restarts > MAX_RETRIES:
                        log("❌ Max retries reached. Aborting.")
                        break
                    time.sleep(RETRY_DELAY_SECONDS)
                else:
                    log("✅ Tests completed successfully.")
                    # Optional: Break if you only want ONE successful pass.
                    # For a "Watcher", maybe we want to run again? 
                    # The requirement says "orchestrate test lifecycle". Usually implies looped testing or 1 prolonged run.
                    # Assuming we want to KEEP running for 6 hours (e.g. repeated stress test?).
                    # If "Watcher" implies "Watch file changes", we rely on `npm test --watch`. 
                    # But here we are invoking `npm test`. 
                    # If it finishes, we'll wait and run again? Or exit?
                    # "After 6 hours... shut down". Implies it runs continuously.
                    # I will add a delay and re-run to fill the 6 hours.
                    log("🔄 Cycle complete. Restarting in 60s...")
                    time.sleep(60)

        except Exception as e:
            log(f"❌ Exception in runner: {e}")
            time.sleep(30)

    if log_cleaner:
        log_cleaner.stop()
    generate_report()
    log("👋 Antigravity Watcher shutdown complete.")

if __name__ == "__main__":
    log("=== Antigravity Watcher Started ===")
    run_tests()
