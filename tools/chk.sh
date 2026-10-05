#!/bin/bash
# Module-aware syntax check: `node --check file.js` does NOT parse a file with top-level await as a module and has passed a
# broken one. Each file is copied to a .mjs first; index.html's module script is checked too.
# usage (from the project root): tools/chk.sh footplay.js anne_next.js ...
cd "$(dirname "$0")/.." || exit 1
T=$(mktemp -d); ok=1
for f in "$@"; do cp "$f" "$T/chk.mjs"; if ! node --check "$T/chk.mjs" 2>"$T/err.txt"; then ok=0; echo "SYNTAX ERROR in $f:"; head -6 "$T/err.txt"; fi; done
python3 -c "
import re,sys;s=open('index.html').read();m=re.findall(r'<script type=\"module\">(.*?)</script>',s,re.S);open(sys.argv[1],'w').write(m[0])" "$T/idx.mjs"
node --check "$T/idx.mjs" 2>"$T/err.txt" || { ok=0; echo 'SYNTAX ERROR in index.html:'; head -6 "$T/err.txt"; }
rm -rf "$T"
[ $ok = 1 ] && echo "ALL OK ($# files + index.html)"
