#ifndef TEST_EMSCRIPTEN_H
#define TEST_EMSCRIPTEN_H
/* Native cleanup tests do not execute browser calls. */
#define emscripten_asm_const_int(...) (0)
#endif
