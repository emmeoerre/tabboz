/* Focused failure-injection tests for the registry/resource ownership guards. */
#define _GNU_SOURCE
#include <assert.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../novantotto/novantotto.h"
#include "../novantotto/handle.h"
#include "../novantotto/winerror.h"

static RESOURCE slot;
static int fail_handle;
static int fail_name;
static int frees;
static int releases;

static void counted_free(void *pointer)
{
    if (pointer) frees++;
    free(pointer);
}
static char *controlled_strdup(const char *text)
{
    if (fail_name) return NULL;
    size_t size = strlen(text) + 1;
    char *copy = malloc(size);
    if (copy) memcpy(copy, text, size);
    return copy;
}
static int controlled_asprintf(char **output, const char *format, ...)
{
    if (fail_name) { *output = NULL; return -1; }
    va_list args, copy;
    va_start(args, format);
    va_copy(copy, args);
    int size = vsnprintf(NULL, 0, format, copy);
    va_end(copy);
    *output = size >= 0 ? malloc((size_t)size + 1) : NULL;
    if (!*output) { va_end(args); return -1; }
    vsnprintf(*output, (size_t)size + 1, format, args);
    va_end(args);
    return size;
}

RESOURCE *AllocateHandle(HandleType type, HWND parent)
{
    if (fail_handle) return NULL;
    memset(&slot, 0, sizeof(slot));
    slot.refcount = 1;
    slot.handle = (HANDLE)1;
    slot.type = type;
    slot.hwndParent = parent;
    return &slot;
}
RESOURCE *GetHandle(HANDLE handle, HandleType type)
{
    return slot.refcount && handle == slot.handle && (type == HANDLE_ANY || type == slot.type) ? &slot : NULL;
}
void ReleaseHandle(HANDLE handle)
{
    RESOURCE *resource = handle;
    assert(resource == &slot);
    assert(resource->lpResourceName == NULL);
    if (resource->type == HANDLE_REGKEY) assert(resource->regKey.lpSubKey == NULL);
    releases++;
    memset(resource, 0, sizeof(*resource));
}

#define free counted_free
#define strdup controlled_strdup
#define asprintf controlled_asprintf
#include "../novantotto/registry.c"
#include "../novantotto/resource.c"
#undef free
#undef strdup
#undef asprintf

int main(void)
{
    HKEY key = (HKEY)999;
    fail_handle = 1;
    assert(RegCreateKeyEx(HKEY_CURRENT_USER, "Test", 0, NULL, 0, 0, NULL, &key, NULL) == ERROR_NOT_ENOUGH_MEMORY);
    assert(key == NULL && frees == 1 && releases == 0);
    frees = 0;
    key = (HKEY)999;
    assert(RegOpenKeyEx(HKEY_CURRENT_USER, "Test", 0, 0, &key) == ERROR_NOT_ENOUGH_MEMORY);
    assert(key == NULL && frees == 1 && releases == 0);

    fail_handle = 0;
    frees = 0;
    assert(RegCreateKeyEx(HKEY_CURRENT_USER, "Test", 0, NULL, 0, 0, NULL, &key, NULL) == ERROR_SUCCESS);
    assert(RegCloseKey(key) == ERROR_SUCCESS);
    assert(frees == 1 && releases == 1);

    frees = releases = 0;
    HICON icon = LoadIcon(NULL, (LPCSTR)7);
    assert(icon != NULL && slot.lpResourceName != NULL);
    assert(DestroyIcon(icon) == TRUE);
    assert(frees == 1 && releases == 1);
    assert(DestroyIcon(icon) == FALSE);
    assert(frees == 1 && releases == 1);

    fail_name = 1;
    frees = releases = 0;
    assert(LoadIcon(NULL, "test-icon") == NULL);
    assert(frees == 0 && releases == 1);
    releases = 0;
    assert(LoadIcon(NULL, (LPCSTR)7) == NULL);
    assert(frees == 0 && releases == 1);
    puts("PASS: registry handle-allocation failures, closed payload ownership, and resource-name allocation failures");
    return 0;
}
