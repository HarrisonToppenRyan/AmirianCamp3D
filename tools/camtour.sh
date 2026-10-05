#!/bin/bash
# Turn the follow camera through a full circle at one spot and save a contact sheet of the 8 views (WebKit).
# usage: tools/camtour.sh "<query, e.g. level=pond&at=20,20>" /path/out_prefix
Q="$1"; OUT="$2"; cd "$(dirname "$0")/.."
steps=(wait:READY sleep:1500)
for i in 0 1 2 3 4 5 6 7; do steps+=("eval:window.__setCam($i*0.7854)" sleep:600 "shot:${OUT}_$i.png" "eval:window.__cam().len"); done
node tools/webkit/play.mjs "http://127.0.0.1:8123/?auto&$Q" quiet=1 w=960 h=600 -- "${steps[@]}" 2>&1 | grep -v "^shot" | tr '\n' ' '; echo
python3 - "$OUT" <<'PY'
import sys
from PIL import Image
o=sys.argv[1]
ims=[Image.open('%s_%d.png'%(o,i)).resize((640,400)) for i in range(8)]
sheet=Image.new('RGB',(640*4,400*2))
for i,im in enumerate(ims): sheet.paste(im,((i%4)*640,(i//4)*400))
sheet.save(o+'_sheet.png')
PY
