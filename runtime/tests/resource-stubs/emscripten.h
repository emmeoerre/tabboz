#ifndef RESOURCE_TEST_EMSCRIPTEN_STUB_H
#define RESOURCE_TEST_EMSCRIPTEN_STUB_H
#define EM_ASM(...) ((void)0)
#define EM_ASM_INT(...) 0
#define CODE_EXPR(code) (code)
#define _EM_ASM_COUNT_ARGS(...) 1
#define _EM_ASM_JOIN(a,b) a##b
#define _EM_ASM_CONCATENATE(a,b) _EM_ASM_JOIN(a,b)
#define _EM_ASM_PREP_ARGS(...) , __VA_ARGS__
static inline int emscripten_asm_const_int(const char *script, ...) { (void)script; return 0; }
#endif
