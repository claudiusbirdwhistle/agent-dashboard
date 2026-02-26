#!/usr/bin/env python3
"""Extract a readable markdown transcript from a Claude stream-json invocation log.

Usage: extract-transcript.py <invocation_log> [output_file]

If output_file is omitted, writes to stdout.
"""

import json
import sys
import os
from datetime import datetime


def extract_transcript(log_path):
    """Parse stream-json log and return markdown transcript."""
    lines = []
    header_lines = []
    model = None
    turn = 0

    with open(log_path, "r") as f:
        for raw_line in f:
            raw_line = raw_line.strip()
            if not raw_line:
                continue

            # Capture the plain-text header lines (prompt, timestamps)
            if raw_line.startswith("===") or raw_line.startswith("Prompt:") or raw_line == "---":
                header_lines.append(raw_line)
                continue

            try:
                event = json.loads(raw_line)
            except json.JSONDecodeError:
                continue

            etype = event.get("type")

            # Extract model from first assistant message
            if etype == "assistant" and not model:
                msg = event.get("message", {})
                model = msg.get("model", "unknown")

            # Assistant text output
            if etype == "assistant":
                msg = event.get("message", {})
                content_blocks = msg.get("content", [])
                text_parts = []
                tool_calls = []
                for block in content_blocks:
                    if block.get("type") == "text":
                        text_parts.append(block.get("text", ""))
                    elif block.get("type") == "tool_use":
                        name = block.get("name", "unknown")
                        inp = block.get("input", {})
                        # Summarize tool input
                        summary = _summarize_tool_input(name, inp)
                        tool_calls.append(f"  - **{name}**: {summary}")

                if text_parts or tool_calls:
                    turn += 1
                    lines.append(f"\n### Turn {turn} — Assistant\n")
                    if text_parts:
                        combined = "\n".join(text_parts).strip()
                        if combined:
                            lines.append(combined)
                    if tool_calls:
                        lines.append("\n**Tool calls:**")
                        lines.extend(tool_calls)

            # Tool results (user messages containing tool_result)
            elif etype == "user":
                msg = event.get("message", {})
                content_blocks = msg.get("content", [])
                results = []
                for block in content_blocks:
                    if block.get("type") == "tool_result":
                        tool_id = block.get("tool_use_id", "?")
                        content = block.get("content", "")
                        if isinstance(content, list):
                            content = " ".join(
                                b.get("text", "") for b in content if isinstance(b, dict)
                            )
                        # Truncate long results
                        if len(content) > 500:
                            content = content[:500] + f"... ({len(content)} chars total)"
                        is_error = block.get("is_error", False)
                        prefix = "ERROR" if is_error else "Result"
                        results.append(f"  - [{prefix}] `{tool_id[:12]}…`: {content[:200]}")
                if results:
                    lines.append("\n**Tool results:**")
                    lines.extend(results)

            # Result event (final summary)
            elif etype == "result":
                cost = event.get("cost_usd")
                duration = event.get("duration_ms")
                turns_used = event.get("num_turns")
                lines.append("\n---\n### Session Summary\n")
                if cost is not None:
                    lines.append(f"- **Cost:** ${cost:.4f}")
                if duration is not None:
                    lines.append(f"- **Duration:** {duration / 1000:.1f}s")
                if turns_used is not None:
                    lines.append(f"- **Turns:** {turns_used}")

    # Build the full transcript
    output = []
    output.append(f"# Invocation Transcript")
    output.append(f"")
    output.append(f"**Log file:** `{os.path.basename(log_path)}`")
    if model:
        output.append(f"**Model:** {model}")

    # Extract timestamp from filename
    basename = os.path.basename(log_path)
    if basename.startswith("invocation_") and basename.endswith(".log"):
        ts = basename[len("invocation_"):-len(".log")]
        output.append(f"**Timestamp:** {ts}")

    # Include prompt from header
    for h in header_lines:
        if h.startswith("Prompt:"):
            prompt_text = h[len("Prompt:"):].strip()
            output.append(f"\n**Prompt:** {prompt_text[:300]}")
            break

    output.append(f"\n---\n")
    output.extend(lines)

    return "\n".join(output)


def _summarize_tool_input(name, inp):
    """Return a short summary of tool input."""
    if name == "Read":
        return f"`{inp.get('file_path', '?')}`"
    elif name == "Write":
        path = inp.get("file_path", "?")
        content = inp.get("content", "")
        return f"`{path}` ({len(content)} chars)"
    elif name == "Edit":
        path = inp.get("file_path", "?")
        old = inp.get("old_string", "")
        return f"`{path}` (replacing {len(old)} chars)"
    elif name == "Bash":
        cmd = inp.get("command", "?")
        if len(cmd) > 120:
            cmd = cmd[:120] + "…"
        return f"`{cmd}`"
    elif name == "Grep":
        pattern = inp.get("pattern", "?")
        path = inp.get("path", ".")
        return f"pattern=`{pattern}` in `{path}`"
    elif name == "Glob":
        return f"`{inp.get('pattern', '?')}`"
    elif name == "TodoWrite":
        todos = inp.get("todos", [])
        return f"{len(todos)} items"
    elif name == "Task":
        desc = inp.get("description", "?")
        return desc
    elif name == "Skill":
        return inp.get("skill", "?")
    else:
        keys = list(inp.keys())[:3]
        return f"({', '.join(keys)})" if keys else "(no input)"


def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <invocation_log> [output_file]", file=sys.stderr)
        sys.exit(1)

    log_path = sys.argv[1]
    transcript = extract_transcript(log_path)

    if len(sys.argv) >= 3:
        with open(sys.argv[2], "w") as f:
            f.write(transcript)
    else:
        print(transcript)


if __name__ == "__main__":
    main()
