#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
# Chapter 2's scenes played to their end one after the other, and (10-12) the ledges' and the Forest of Lys's new ones (29 lines; ONE headless browser at a time; about 11 minutes):
# each line is name|console text to wait for|URL parameters. A scene passes when it prints "done (seen=true, ...)".
# usage (from the project root, the game served at 127.0.0.1:8123): tools/reg2.sh [dir for the screenshots]
SP=${1:-$(mktemp -d)}; mkdir -p "$SP"
kill_chrome() { for p in $(ps aux | grep -i "Google Chrome" | grep -v grep | grep -i "remote-debugging" | awk '{print $2}'); do kill $p 2>/dev/null; done; }
while IFS='|' read -r name wait q; do
  [ -z "$name" ] && continue
  r=$(node tools/cdp_run.mjs "http://127.0.0.1:8123/?auto&fresh&$q" gpu=1 dpr=1 w=900 h=560 wait="$wait" delay=2500 timeout=300000 shot="$SP/$name.png" eval="JSON.stringify({g:__dbg.A.groundStats(),shoes:__dbg.A.shoes(),prog:__dbg.story.S.progress,err:(document.querySelector('#err')||{}).textContent||''})" 2>&1 | grep -E "CH2 |LYS |CLIMB |BOUND|SHOES going on|HOLD reached|^done|exception|EVAL|CAMFIX|EXIT to|story scene failed" | sed 's/^\[log\] //' | cut -c1-110 | tr '\n' ' ')
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
lys_hornet_tamed|LYS hornet tamed|level=lys&prog=106&flags=boudicca,dryadDone&ev=hornet0&sa=hhhhhhhhhhhh&pick=0,0,0,2&ts=3
lys_hornet_lost|LYS hornet caught lost|level=lys&prog=106&flags=boudicca,dryadDone&ev=hornet0&sa=m&ts=3
lys_slime_tamed|LYS slime tamed|level=lys&prog=106&flags=dryadDone&ev=slime0&sa=hhhhhhhhhhhh&pick=0,1,0,0,2&ts=3
lys_slime_free|LYS slime caught free|level=lys&prog=106&flags=boudicca,dryadDone&ev=slime1&sa=mmh&ts=3
lys_trap_ivy|SHOES going on|level=lys&prog=106&flags=boudicca,dryadDone&ev=ltrap1&sa=mmmh&ts=3
lys_trap_fairies|SHOES going on|level=lys&prog=106&flags=boudicca,dryadDone&ev=ltrap2&trapkind=fairies&sa=mmmm&ts=3
lys_gnome|LYS gnome look done|level=lys&prog=106&flags=dryadDone,lgnomeSprung&ev=lgnomeLook&sa=m&ts=3
lys_myc|LYS myc won|level=lys&prog=106&flags=boudicca,dryadDone&ev=lysmyc0&sa=hh&pick=0&ts=3
lys_climb_up|CLIMB up weeds done|level=lys&prog=106&flags=boudicca,dryadDone&ev=climbUp_weeds&sa=m&pick=0&ts=3
lys_climb_down|CLIMB down glade done|level=lys&prog=106&flags=boudicca,dryadDone&at=30,27&ev=climbDown_glade&sa=m&pick=0&ts=3
forest_climb|CLIMB up B done|level=forest&prog=40&ev=climbUp_B&sa=m&pick=0&ts=3
forest_myc_ledge|SHOE LINE clean|level=forest&prog=20&at=31,46&ev=myc5&sa=m&ts=3
LIST
