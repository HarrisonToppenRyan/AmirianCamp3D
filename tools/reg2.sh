#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
# Chapter 2's scenes played to their end one after the other (17 of them; ONE headless browser at a time; about 6 minutes):
# each line is name|console text to wait for|URL parameters. A scene passes when it prints "done (seen=true, ...)".
# usage (from the project root, the game served at 127.0.0.1:8123): tools/reg2.sh [dir for the screenshots]
SP=${1:-$(mktemp -d)}; mkdir -p "$SP"
kill_chrome() { for p in $(ps aux | grep -i "Google Chrome" | grep -v grep | grep -i "remote-debugging" | awk '{print $2}'); do kill $p 2>/dev/null; done; }
while IFS='|' read -r name wait q; do
  [ -z "$name" ] && continue
  r=$(node tools/cdp_run.mjs "http://127.0.0.1:8123/?auto&fresh&$q" gpu=1 dpr=1 w=900 h=560 wait="$wait" delay=2500 timeout=300000 shot="$SP/$name.png" eval="JSON.stringify({g:__dbg.A.groundStats(),shoes:__dbg.A.shoes(),prog:__dbg.story.S.progress,err:(document.querySelector('#err')||{}).textContent||''})" 2>&1 | grep -E "CH2 |BOUND|SHOES going on|HOLD reached|^done|exception|EVAL|CAMFIX|EXIT to|story scene failed" | sed 's/^\[log\] //' | cut -c1-110 | tr '\n' ' ')
  echo "$name: $r"; kill_chrome
done <<'LIST'
post_reading|CH2 reading done|level=post&prog=100&flags=boudicca,camellia,postPurse&coins=1000&ev=camellia&pick=0&sa=mhm&ts=3
post_reading_miss|CH2 reading done|level=post&prog=100&flags=boudicca,camellia,postPurse&coins=1000&ev=camellia&pick=0&sa=mmm&ts=3
post_reading_late|CH2 reading done|level=post&prog=140&flags=boudicca,camellia,postPurse&coins=1000&ev=camellia&pick=0&sa=h&ts=3
post_camellia|CH2 camellia done|level=post&prog=100&flags=boudicca,postPurse&coins=200&ev=camellia&pick=1,2,0,1,3,4,3&sa=m&ts=3
post_night|CH2 morning done|level=post&prog=100&flags=boudicca&ev=fire&pick=0&sa=mmh&ts=3
post_night_lost|CH2 morning done|level=post&prog=100&flags=boudicca&ev=fire&pick=0&sa=mmm&ts=3
lys_intro|CH2 lysintro done|level=lys&prog=100&flags=boudicca&sa=m&ts=3
lys_capture|CH2 capture done|level=lys&prog=105&flags=boudicca&ev=dryad&sa=mmmh&ts=3
lys_capture_lost|CH2 capture done|level=lys&prog=105&flags=boudicca&ev=dryad&sa=mmmm&ts=3
lys_fight_lost|CH2 capture done|level=lys&prog=105&flags=boudicca,dryadMet&ev=dryad&sa=hmh&ts=3
lys_dryad|CH2 dryad done|level=lys&prog=105&flags=boudicca,dryadMet&ev=dryad&sa=hhhhhhhhhh&pick=0,1,0,0,2&ts=3
lys_ivy|SHOES going on|level=lys&prog=105&flags=boudicca,dryadDone&ev=lysivy0&sa=mmmmh&ts=3
lys_mainroad|CH2 mainroad done|level=lys&prog=105&flags=boudicca,dryadDone&ev=mainRoad&sa=m&ts=3
val_guard|CH2 guard done|level=valyndra&prog=110&flags=boudicca&sa=m&ts=3
barracks|EXIT to valyndra|level=barracks&prog=120&flags=boudicca&sa=m&ts=3&noexit
val_closing|CH2 chapter done|level=valyndra&prog=130&flags=boudicca&at=19,11&sa=m&ts=3
barracks_after|READY|level=barracks&prog=130&flags=boudicca
LIST
