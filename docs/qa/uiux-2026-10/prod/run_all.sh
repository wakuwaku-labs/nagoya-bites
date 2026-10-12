#!/bin/zsh
# 本番の確認を一式まわす（変更ごとの 7 つの確認 + トップのスモーク + 計測イベント）。
# 使い方: docs/qa/uiux-2026-10/prod/run_all.sh [--base=https://nagoya-bites.com]
# 出力に Google マップのキー（"AI" + "za" で始まる文字列）が出ても、その場で [KEY] に置き換える（どこにも書かない）。
cd "$(git rev-parse --show-toplevel)" || exit 1
P=docs/qa/uiux-2026-10/prod
BASE_ARG="${1:-}"
KEYRE='A''Iza[0-9A-Za-z_-]+'
for n in i26c i37 i14b i14d i14a i14e i14c; do
  echo "-----PROBE $n"
  perl -e 'alarm 200; exec @ARGV' node $P/prod_held.js $n $BASE_ARG 2>&1 | sed -E "s/$KEYRE/[KEY]/g" | grep -E "FAIL|合計" | cut -c1-260
done
echo "-----SMOKE"
perl -e 'alarm 200; exec @ARGV' node $P/prod_smoke.js 2>&1 | sed -E "s/$KEYRE/[KEY]/g" | grep -E "FAIL|合計"
echo "-----EVENTS"
perl -e 'alarm 200; exec @ARGV' node $P/prod_events.js 2>&1 | sed -E "s/$KEYRE/[KEY]/g" | grep -E "FAIL|合計"
echo "exit=0"
