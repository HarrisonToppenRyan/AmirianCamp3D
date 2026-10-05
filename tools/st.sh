#!/bin/bash
# tools/st.sh <name> "<query>" [wait text] [w] [h]: run one story test in headless Chrome and save build/st/<name>.png
# (ST_OUT=<dir> saves elsewhere; EVAL=<js> evaluates in the page once the wait text has appeared; TIMEOUT, CUT, TAIL)
cd "$(dirname "$0")/.."
OUT=${ST_OUT:-build/st}
mkdir -p "$OUT"
node tools/cdp_run.mjs "http://127.0.0.1:8123/?auto&fresh&$2" gpu=1 dpr=1 w=${4:-1100} h=${5:-700} wait="${3:-HOLD reached}" timeout=${TIMEOUT:-100000} shot="$OUT/$1.png" ${EVAL:+eval="$EVAL"} 2>&1 | grep -iv "^\[log\] \(PERF\|READY\|SIM\)" | cut -c1-${CUT:-500} | tail -${TAIL:-5}
