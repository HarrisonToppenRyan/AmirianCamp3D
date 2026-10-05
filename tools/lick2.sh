#!/bin/bash
# tools/lick2.sh <name> "<query with ls= or ms=>" : the same as tools/lick.sh for the log scene's tongues (the Kuns', the mimic shoes'): window.__lick2
cd "$(dirname "$0")/.."
EVAL="new Promise((res)=>{const L=window.__lick2;L.len=L.far=L.push=L.n=0;setTimeout(()=>res({len_mm:+(L.len*1000).toFixed(1),short_mm:+(L.far*1000).toFixed(1),pushed_mm:+(L.push*1000).toFixed(1),licks:L.n}),${SECS:-5}000);})" \
TIMEOUT=${TIMEOUT:-300000} CUT=300 TAIL=2 bash tools/st.sh "$1" "$2" "HOLD reached" ${3:-1100} ${4:-700}
