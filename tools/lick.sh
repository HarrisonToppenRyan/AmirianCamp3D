#!/bin/bash
# tools/lick.sh <name> "<query with hold=<mark>>" : hold a scene where something licks her soles, let it lick for 5 s, and
# print the tongue statistics (captures.js lickStat: longest tongue drawn, how far short of the sole the worst one fell,
# the most any ring had to be pushed out of the sole; all in mm). Saves build/st/<name>.png.
cd "$(dirname "$0")/.."
EVAL="new Promise((res)=>{const L=window.__lick;L.len=L.far=L.push=L.n=0;setTimeout(()=>res({len_mm:+(L.len*1000).toFixed(1),short_mm:+(L.far*1000).toFixed(1),pushed_mm:+(L.push*1000).toFixed(1),licks:L.n}),${SECS:-5}000);})" \
TIMEOUT=${TIMEOUT:-300000} CUT=300 TAIL=2 bash tools/st.sh "$1" "$2" "HOLD reached" ${3:-1100} ${4:-700}
