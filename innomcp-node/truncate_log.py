
import os

LOG_FILE = "antigravity_session.log"

if os.path.exists(LOG_FILE):
    try:
        size = os.path.getsize(LOG_FILE)
        print(f"Original size: {size} bytes")
        
        with open(LOG_FILE, "r", encoding="utf-8", errors='ignore') as f:
            lines = f.readlines()
        
        print(f"Original lines: {len(lines)}")
        
        if len(lines) > 100:
            new_lines = lines[-100:]
            with open(LOG_FILE, "w", encoding="utf-8") as f:
                f.writelines(new_lines)
            print(f"Truncated to {len(new_lines)} lines.")
        else:
            print("Lines <= 100, no truncation needed.")
            
    except Exception as e:
        print(f"Error: {e}")
else:
    print("Log file not found.")
