#!/bin/bash
# Stop MLX and signal supervisor to not restart

MODEL_NAME="${1:-Qwen3-Coder-MLX-4bit-REAL}"
STATE_FILE="/tmp/mlx-supervisor-${MODEL_NAME}.state"

# Signal supervisor this is a normal stop
echo "normal_stop" > "$STATE_FILE"

# Stop MLX
mlx stop "$MODEL_NAME"

# Kill supervisor if running
SUPERVISOR_PID=$(cat "/tmp/mlx-supervisor-${MODEL_NAME}.lock" 2>/dev/null)
if [[ -n "$SUPERVISOR_PID" ]] && kill -0 "$SUPERVISOR_PID" 2>/dev/null; then
    echo "Stopping supervisor (PID: $SUPERVISOR_PID)"
    kill "$SUPERVISOR_PID"
fi

echo "MLX stopped gracefully"
