#!/bin/bash
# Frame cost of a view in WebKit (Safari's engine) on the real GPU, at the size of a full-screen 13" MacBook window.
# usage: tools/perf.sh "<extra query, e.g. &only=terrain or &ls=tickle>" [secs]
# Prints the average and worst time to draw one frame INCLUDING the GPU (a pixel is read back each frame to wait for it).
# The read-back itself costs about 3.6 ms at full resolution in WebKit; that is already subtracted in "frame".
# Budget: frame <= 11 ms. Numbers are only meaningful when nothing else heavy is running: run it three times, take the lowest.
cd "$(dirname "$0")/.."
Q="$1"; SECS="${2:-6}"
if [[ "$Q" == *"ls="* ]]; then WAIT="HOLD reached"; EXTRA="&rt=1"; else WAIT="PERF done"; EXTRA="&cam=13.6,2.6,19.5,13.6,1.2,14"; fi
[[ "$Q" == *"cam="* ]] && EXTRA="${EXTRA/&cam=13.6,2.6,19.5,13.6,1.2,14/}"
node tools/webkit/run.mjs "http://127.0.0.1:8123/index.html?auto&perf=2&noadapt=1&secs=$SECS$EXTRA$Q&v=p$RANDOM" w=1470 h=956 dpr=2 wait="$WAIT" delay=200 timeout=240000 2>&1 \
 | grep -E "PERF \{|exception|\[error\]|\[warning\]" \
 | python3 -c "
import sys, json, re
for line in sys.stdin:
    m = re.search(r'PERF (\{.*\})', line)
    if not m: print(line.strip()[:300]); continue
    d = json.loads(m.group(1)); px = d['size'][0] * d['size'][1]; over = 2.0 + 1.55 * px / 4.096e6
    print(f\"frame {d['renMs'] - over:5.1f} ms avg, {d['renMax'] - over:5.1f} ms worst | update {d['updMs']} ms | {d['calls']} draw calls, {d['tris']} triangles, {d['programs']} shaders, {d['tex']} textures | {d['size'][0]}x{d['size'][1]} {d['post']}\")
"
