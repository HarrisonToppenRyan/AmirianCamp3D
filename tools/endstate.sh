#!/bin/bash
# tools/endstate.sh <name> "<query>" : start a story event (&ev=...), let the test driver play it (&sa=, &pick=), and print
# the state the scene leaves behind (shoes, hat, clip, height), whether the spot she is left on is clear (atEnd: free /
# blocked / out of bounds, as index.html's walking rules see it) and how far she can walk from it in half a second (canWalk, metres). Saves build/st/<name>.png.
cd "$(dirname "$0")/.."
EV=$(echo "$2" | sed -n 's/.*ev=\([A-Za-z0-9_]*\).*/\1/p')
EVAL="new Promise((res)=>{let seen=false,t0=performance.now();const d=window.__dbg,a=d.A,P=d.anne.position;const kd=(c,t)=>dispatchEvent(new KeyboardEvent(t,{code:c,key:c.slice(3).toLowerCase(),bubbles:true}));const walk=async()=>{let best=0;for(const c of ['KeyW','KeyD','KeyS','KeyA']){const x=P.x,z=P.z;kd(c,'keydown');await new Promise(r=>setTimeout(r,450));kd(c,'keyup');await new Promise(r=>setTimeout(r,120));best=Math.max(best,Math.hypot(P.x-x,P.z-z));}return +best.toFixed(2);};const tick=async()=>{const on=d.scene();if(on)seen=true;if((seen&&!on)||performance.now()-t0>${MAXMS:-200000}){const st=window.__stuck?window.__stuck():null;await new Promise(r=>setTimeout(r,500));const moved=await walk();res({ended:seen&&!on,dbg:a.debug(),shoes:a.shoes(),y:+P.y.toFixed(3),prog:d.story.S.progress,atEnd:st,canWalk:moved});}else setTimeout(tick,250);};tick();})" \
TIMEOUT=${TIMEOUT:-300000} CUT=700 TAIL=3 bash tools/st.sh "$1" "$2" "EV $EV" ${3:-1100} ${4:-700}
