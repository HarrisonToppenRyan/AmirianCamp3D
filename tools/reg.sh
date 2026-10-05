#!/bin/bash
cd "$(dirname "$0")/.." || exit 1
# The capture scenes played to their end one after the other (26 of them; about 12 minutes; ONE headless browser at a time;
# the last four: the geta, and three with a look of the player's own, batch 22):
# each line is name|console text to wait for|URL parameters. A scene passes when it prints "done (seen=true, ...)".
# usage (from the project root, the game served at 127.0.0.1:8123): tools/reg.sh [dir for the screenshots]
SP=${1:-$(mktemp -d)}; mkdir -p "$SP"
kill_chrome() { for p in $(ps aux | grep -i "Google Chrome" | grep -v grep | grep -i "remote-debugging" | awk '{print $2}'); do kill $p 2>/dev/null; done; }
while IFS='|' read -r name wait q; do
  [ -z "$name" ] && continue
  r=$(node tools/cdp_run.mjs "http://127.0.0.1:8123/?auto&fresh&$q" gpu=1 dpr=1 w=900 h=560 wait="$wait" delay=2500 timeout=240000 shot="$SP/$name.png" eval="JSON.stringify({g:__dbg.A.groundStats(),shoes:__dbg.A.shoes(),err:(document.querySelector('#err')||{}).textContent||''})" 2>&1 | grep -E "BOUND chained|SHOES going on|SHOE FLASH|SHOE BRUSH|FOOTPLAY clean done|SHOE LINE (clean|out)|HOLD reached|^done|exception|EVAL|CAMFIX" | sed 's/^\[log\] //' | cut -c1-90 | tr '\n' ' ')
  echo "$name: $r"; kill_chrome
done <<'LIST'
ivy|SHOES going on|level=forest&prog=12&ev=ivy0&sa=mmmmh&ts=3
myc|SHOE LINE clean|level=forest&prog=12&ev=myc0&sa=mmmmh&ts=3
alraune|SHOES going on|level=nest&prog=25&ev=alraune&sa=mmmmh&ts=3
scylla|SHOES going on|level=caves&prog=20&ev=ctrap&sa=mmmmmmmmh&ts=3
pumpkin|SHOES going on|level=camp&prog=10&ev=pumpkin&sa=mmmh&ts=3
hole_vines|SHOE LINE clean|level=camp&prog=10&ev=hole&pick=0&sa=mmmh&ts=3
hole_fairies|SHOE LINE out|level=camp&prog=10&ev=hole&pick=1,1&sa=mmmh&ts=3
hole_thief|SHOES going on|level=camp&prog=10&ev=hole&pick=2&sa=mmmh&ts=3
hole_ivy|SHOE LINE clean|level=camp&prog=10&ev=hole&pick=3&sa=mmmh&ts=3
hole_ghosts|SHOE LINE clean|level=camp&prog=10&ev=hole&pick=4&sa=mmmh&ts=3
hole_lost|SHOES going on|level=camp&prog=10&ev=hole&pick=4&sa=mmmm&ts=3
feather|SHOES going on|level=camp&prog=10&flags=feather&ev=fire&pick=1,0,1&sa=hit&ts=3
mimic|HOLD reached|ms=mdone&prog=10
log|HOLD reached|ls=cdone&prog=10
logwet4|HOLD reached|ls=wet4&prog=10
logwet3|HOLD reached|ls=wet3&prog=10
ghosts_mules|SHOE LINE clean|level=camp&prog=10&ev=hole&pick=4&sa=mmmh&ts=3&shoe=mules
vines_wedges|SHOE LINE clean|level=camp&prog=10&ev=hole&pick=0&sa=mmmh&ts=3&shoe=wedges
myc_flats|SHOE LINE clean|level=forest&prog=12&ev=myc0&sa=mmmmh&ts=3&shoe=flats
ivy_gladiator|SHOES going on|level=forest&prog=12&ev=ivy0&sa=mmmmh&ts=3&shoe=gladiator
alraune_cross|SHOES going on|level=nest&prog=25&ev=alraune&sa=mmmmh&ts=3&shoe=cross
pumpkin_heels|SHOES going on|level=camp&prog=10&ev=pumpkin&sa=mmmh&ts=3&shoe=heels
ghosts_geta|SHOE LINE clean|level=camp&prog=10&ev=hole&pick=4&sa=mmmh&ts=3&shoe=geta
ivy_look|SHOES going on|level=forest&prog=12&ev=ivy0&sa=mmmmh&ts=3&lk=%7B%22species%22%3A%22demon%22%2C%22outfit%22%3A%22queen%22%2C%22skin%22%3A%22%236f4326%22%2C%22name%22%3A%22Zara%22%2C%22body%22%3A%7B%22w%22%3A1.12%2C%22h%22%3A1.06%7D%7D
scylla_look|SHOES going on|level=caves&prog=20&ev=ctrap&sa=mmmmmmmmh&ts=3&lk=%7B%22species%22%3A%22angel%22%2C%22outfit%22%3A%22beach%22%2C%22hairStyle%22%3A%22braids%22%7D
thief_look|SHOES going on|level=camp&prog=10&ev=hole&pick=2&sa=mmmh&ts=3&lk=%7B%22species%22%3A%22cat%22%2C%22outfit%22%3A%22bunny%22%2C%22legwear%22%3Afalse%2C%22body%22%3A%7B%22w%22%3A0.9%2C%22h%22%3A0.94%7D%7D
LIST
