# Python Commenting Guide -- Data Platform Projects

## File Header Block

Every Python script starts with a structured docstring.

```python
"""
===================================================================================
Script: ScriptName.py
Purpose:
    Clear description of what this script does. Include data source,
    transformation logic, and output.

Steps:
    1. First major step.
    2. Second major step.
    3. Continue numbering all steps.
    4. Include validation and error handling.
    5. Output and cleanup.

Requirements:
    - Python libraries (pandas, openpyxl, etc.)
    - Network access requirements
    - File format expectations

Author: Frank Kelly
Date: DD-MM-YYYY
[Updated: DD-MM-YYYY - Description of change]
===================================================================================
"""
```

Rules:

- Exactly 83 equals signs top and bottom
- Steps match actual function calls in main()
- Purpose explains why, not just what
- Add Updated line for significant changes (keep original date)

## Section Headers

Organise code with clear section markers.

```python
# === SECTION NAME ===
```

Standard order:

1. IMPORTS
2. CONFIGURATION
3. LOGGING FUNCTIONS
4. ETL STEP FUNCTIONS
5. MAIN FUNCTION
6. ENTRY POINT

Guidelines:

- ALL CAPS for section names
- One blank line before and after
- Keep this order

## Function Documentation

Use concise docstrings.

```python
def function_name():
    """Step 1 – Brief description of what this does."""
    try:
        # implementation
    except Exception as e:
        log_exception("function_name", e)
        sys.exit(1)
```

Rules:

- Triple double-quotes
- ETL functions: Start with "Step N –"
- Use en-dash (–) not hyphen (-)
- One line if possible
- Describe outcome, not implementation

## Inline Comments

Use sparingly. Explain why, not what.

```python
# OPENREVS export sometimes missing 2ndHome column
if '2ndHome' not in df.columns:
    df['2ndHome'] = ""

# keep=False removes ALL duplicates, not just subsequent ones
df_clean = df.drop_duplicates(subset='UPRN', keep=False)
```

Guidelines:

- Place above code, not at end of line
- Start with `# ` (hash + space)
- Explain intent, edge cases, non-obvious logic
- Do not comment obvious code

## Variable Naming

Use lowercase with underscores.

```python
source_path = r"\\server\share\folder"
log_file = os.path.join(log_path, "ProcessScript.log")
columns_to_keep = ['Column1', 'Column2']
valid_descrips = {'VALUE1', 'VALUE2'}
```

Guidelines:

- Descriptive names
- Plural for collections
- Clear domain meaning

## Error Handling Pattern

Every function follows this structure.

```python
def step_function():
    """Step N – Description."""
    try:
        # implementation
        write_log("Step N complete – Brief result.")
        return result
    except Exception as e:
        log_exception("step_function", e)
        sys.exit(N)  # Step number as exit code
```

Rules:

- Wrap function body in try/except
- Use log_exception() for errors
- Exit with step number
- Log completion message

## Main Function Structure

Mirror the Steps from header.

```python
def main():
    write_log("START – ScriptName.py")
    try:
        # Step 1 – Description
        ensure_required_folders()

        # Step 2 – Description
        source_file, temp_path = copy_file()

        # Step 3 – Description
        df = process_data(temp_path)

        write_log("END – ScriptName.py – SUCCESS")
    except Exception as e:
        log_exception("main", e)
        write_log("END – ScriptName.py – FAILED")
        sys.exit(99)
```

Rules:

- START message at top of main()
- Comment each step
- END message with SUCCESS or FAILED at close
- Exit code 99 for main() errors

## Logging Standards

Be specific and terse.

```python
write_log("Step 2 complete – Copied file to working directory")
write_log(f"Filtered {len(df)} rows matching criteria")
write_log(f"Removed {dup_count} duplicate UPRNs")
write_log(f"ERROR: Expected one .xlsx file, found {len(files)}")
```

Guidelines:

- Use write_log() for info
- Use log_exception() for errors
- Include step completion
- Log meaningful metrics
- Be specific and actionable

## Code Organisation

```python
# Standard library first
import os
import sys
from datetime import datetime

# Third-party second
import pandas as pd

# Local third (if any)
```

Rules:

- Two blank lines before section headers
- One blank line between functions
- Keep lines under 100 characters where practical

## Quick Reference

Before committing:

- [ ] Header with Script/Purpose/Steps/Requirements/Author/Date
- [ ] Sections in standard order with === headers
- [ ] Functions have docstrings
- [ ] ETL functions numbered to match Steps
- [ ] Error handling with log_exception and sys.exit
- [ ] Step completion logging
- [ ] Main with START/FINISHED messages
- [ ] Comments explain why, not what
