#!/bin/bash
# MLX Supervisor - Auto-restart on crash, not on normal stop

MODEL_NAME="${1:-Qwen3-Coder-MLX-4bit-REAL}"
PORT="${2:-11453}"
LOCK_FILE="/tmp/mlx-supervisor-${MODEL_NAME}.lock"
STATE_FILE="/tmp/mlx-supervisor-${MODEL_NAME}.state"
MAX_RESTARTS=5
RESTART_WINDOW=300  # 5 minutes

# Trap cleanup on script exit
cleanup() {
    echo "$(date): Supervisor shutting down gracefully"
    echo "normal_stop" > "$STATE_FILE"
    mlx stop "$MODEL_NAME" 2>/dev/null
    rm -f "$LOCK_FILE"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Create lock file
echo $$ > "$LOCK_FILE"
echo "running" > "$STATE_FILE"

restart_count=0
restart_times=()
backoff_seconds=5  # Initial backoff delay

echo "$(date): MLX Supervisor started for $MODEL_NAME"

while true; do
    # Check if this is a normal stop
    if [[ -f "$STATE_FILE" ]] && grep -q "normal_stop" "$STATE_FILE"; then
        echo "$(date): Normal stop detected, exiting supervisor"
        rm -f "$LOCK_FILE"
        exit 0
    fi

    # Check if MLX is running on the port
    if ! lsof -i:$PORT -sTCP:LISTEN -t > /dev/null 2>&1; then
        echo "$(date): MLX not running, starting..."

        # Check restart rate limiting
        current_time=$(date +%s)
        restart_times=("${restart_times[@]}" "$current_time")

        # Remove restart times older than RESTART_WINDOW
        recent_restarts=()
        for t in "${restart_times[@]}"; do
            if (( current_time - t < RESTART_WINDOW )); then
                recent_restarts+=("$t")
            fi
        done
        restart_times=("${recent_restarts[@]}")

        # Check if too many restarts
        if (( ${#restart_times[@]} >= MAX_RESTARTS )); then
            echo "$(date): ERROR: Too many restarts (${MAX_RESTARTS} in ${RESTART_WINDOW}s)"
            echo "$(date): MLX may be crashing repeatedly. Manual intervention required."
            exit 1
        fi

        # Start MLX with backoff delay
        echo "$(date): Waiting ${backoff_seconds}s before restart (backoff)"
        sleep "$backoff_seconds"

        mlx start "$MODEL_NAME" --port "$PORT" &
        sleep 5

        # Wait for health check
        max_wait=30
        waited=0
        while (( waited < max_wait )); do
            if curl -s http://localhost:$PORT/health > /dev/null 2>&1; then
                echo "$(date): MLX started successfully"
                restart_count=$((restart_count + 1))
                # Reset backoff on successful start
                backoff_seconds=5
                break
            fi
            sleep 2
            waited=$((waited + 2))
        done

        if (( waited >= max_wait )); then
            echo "$(date): WARNING: MLX started but health check failed"
            # Exponential backoff: double delay up to max 60s
            backoff_seconds=$((backoff_seconds * 2))
            if (( backoff_seconds > 60 )); then
                backoff_seconds=60
            fi
        fi
    fi

    # Health check every 10 seconds
    sleep 10

    # Check if MLX is still listening on port
    if ! lsof -i:$PORT -sTCP:LISTEN -t > /dev/null 2>&1; then
        echo "$(date): MLX died unexpectedly (restart #$restart_count)"
        # Apply backoff on crash
        backoff_seconds=$((backoff_seconds * 2))
        if (( backoff_seconds > 60 )); then
            backoff_seconds=60
        fi
        # Loop will restart it
    fi
done
