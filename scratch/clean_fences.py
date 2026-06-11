import glob
import os

src_path = "C:/Users/USER-NT/DEV/innomcp/innomcp-next/src"
files = glob.glob(src_path + "/**/*.ts", recursive=True) + glob.glob(src_path + "/**/*.tsx", recursive=True)

cleaned_count = 0

for f in files:
    if not os.path.isfile(f):
        continue
    try:
        with open(f, "r", encoding="utf-8") as file:
            content = file.read()
        
        lines = content.splitlines()
        if not lines:
            continue
            
        modified = False
        # Check if first line starts with ```
        if lines[0].strip().startswith("```"):
            lines.pop(0)
            modified = True
            
        # Check if last line starts with ```
        if lines and lines[-1].strip().startswith("```"):
            lines.pop()
            modified = True
            
        if modified:
            with open(f, "w", encoding="utf-8", newline="") as file:
                file.write("\n".join(lines) + "\n")
            print(f"Cleaned: {os.path.basename(f)}")
            cleaned_count += 1
    except Exception as e:
        print(f"Error reading/writing {f}: {e}")

print(f"Total cleaned: {cleaned_count}")
