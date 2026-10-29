#!/usr/bin/env bash
set -euo pipefail
cd /src
sources=(engine/disco.c engine/eventi.c engine/lavoro.c engine/proteggi.c engine/readkey.c engine/scooter.c engine/scuola.c engine/tabimg.c engine/telefono.c engine/tempo.c engine/tipa.c engine/vestiti.c engine/zarrosim.c runtime/novantotto/*.c runtime/browser_bridge.c)
emcc "${sources[@]}" -o runtime/build/tabboz.js \
  -Iruntime/novantotto -O1 -g2 \
  -sASYNCIFY=1 \
  -sGLOBAL_BASE=66536 \
  -sASSERTIONS=1 \
  -sSTACK_OVERFLOW_CHECK=2 \
  -sALLOW_MEMORY_GROWTH=1 \
  -sENVIRONMENT=web \
  -sASYNCIFY_IMPORTS='["emscripten_asm_const_int"]' \
  -sEXPORTED_RUNTIME_METHODS='["ccall","setValue","UTF8ToString","stringToUTF8"]' \
  -sEXPORTED_FUNCTIONS='["_main","_GetDlgItem","_PostMessage","_PrintMessages","_AllocateControl","_GetTickCount","_WinMainStartup","_SalvaTutto","_TabbozHandleCount","_TabbozHandleCapacity","_malloc","_free"]'
