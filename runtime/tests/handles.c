/* Native regression for the actual Novantotto handle/dialog implementation.
 * Build: gcc -std=c11 -Iruntime/tests/include runtime/tests/handles.c -o .cache/handles-test.exe
 */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include "../novantotto/handle.h"

static void *owned[1024];
static int owned_count;
static int fail_properties;
static int frees;

static void *owned_alloc(size_t size)
{
    void *pointer = calloc(1, size);
    assert(pointer != NULL);
    for (int i = 0; i < 1024; i++)
    {
        if (owned[i] == NULL)
        {
            owned[i] = pointer;
            owned_count++;
            return pointer;
        }
    }
    abort();
}

static void owned_free(void *pointer)
{
    if (pointer == NULL) return;
    for (int i = 0; i < 1024; i++)
    {
        if (owned[i] == pointer)
        {
            owned[i] = NULL;
            owned_count--;
            frees++;
            free(pointer);
            return;
        }
    }
    // Catches double frees and the old free(table-entry) failure path.
    assert(!"free of unowned or previously freed allocation");
}

static char *owned_string(const char *text)
{
    char *copy = owned_alloc(strlen(text) + 1);
    strcpy(copy, text);
    return copy;
}

PROPERTIES *AllocateProperties(void)
{
    if (fail_properties)
    {
        fail_properties = 0;
        return NULL;
    }
    PROPERTIES *props = owned_alloc(sizeof(*props));
    props->capacity = 1;
    props->len = 1;
    props->entries = owned_alloc(sizeof(*props->entries));
    props->entries[0].key = owned_string("owned-property");
    return props;
}

void FreeProperties(PROPERTIES *props)
{
    for (int i = 0; i < props->capacity; i++) owned_free((void *)props->entries[i].key);
    owned_free(props->entries);
    owned_free(props);
}

// Compile the production cleanup, not a rewritten test implementation.
#define free owned_free
#ifndef HANDLE_IMPLEMENTATION
#define HANDLE_IMPLEMENTATION "../novantotto/handle.c"
#endif
#include HANDLE_IMPLEMENTATION
#undef free
#include "../novantotto/dialog.c"

// Minimal UI/message stand-ins: handle cleanup itself is the real source.
BOOL PostMessage(HWND hwnd, WORD message, WORD wParam, LONG lParam) { return TRUE; }
BOOL GetMessage(LPMSG message, HWND hwnd, UINT min, UINT max)
{
    GetHandle(hwnd, HANDLE_WINDOW)->window.dialogResult = 73;
    return FALSE;
}
LRESULT DispatchMessage(const MSG *message) { return 0; }
LRESULT SendMessage(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) { return 0; }
BOOL GetClassInfo(HINSTANCE instance, LPCSTR className, LPWNDCLASS result) { return FALSE; }
BOOL DestroyWindow(HWND hwnd)
{
    RESOURCE *res = GetHandle(hwnd, HANDLE_WINDOW);
    if (!res) return FALSE;
    ReleaseHandle(res);
    return TRUE;
}

static INT_PTR dialog_proc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) { return TRUE; }

static int live_handles(void)
{
    int count = 0;
    if (!global_table) return 0;
    for (int i = 0; i < global_table->count; i++) count += global_table->entries[i].refcount > 0;
    return count;
}

static RESOURCE *control(HWND parent, int id)
{
    RESOURCE *res = AllocateHandle(HANDLE_CONTROL, parent);
    assert(res);
    res->control.nIDDlgItem = id;
    res->lpClassName = owned_string("BUTTON");
    res->props = AllocateProperties();
    return res;
}

static void repeated_dialog_lifecycles(void)
{
    RESOURCE *main = AllocateHandle(HANDLE_WINDOW, NULL);
    assert(main);
    const int baseline_handles = live_handles();
    const int baseline_owned = owned_count;
    for (int iteration = 0; iteration < 1000; iteration++)
    {
        RESOURCE *dialog = AllocateHandle(HANDLE_WINDOW, main->handle);
        assert(dialog);
        const HWND hwnd = dialog->handle;
        for (int i = 0; i < 10; i++) control(hwnd, 100 + i);
        assert(GetDlgItem(hwnd, 105) != NULL);
        ReleaseHandle(dialog);
        assert(live_handles() == baseline_handles);
        assert(owned_count == baseline_owned);
        assert(GetDlgItem(hwnd, 105) == NULL);
        // Releasing an already-freed slot must not free its old pointers again.
        ReleaseHandle(dialog);
    }
    ReleaseHandle(main);
    assert(live_handles() == 0 && owned_count == 0);
}

static void nested_and_independent_owners(void)
{
    RESOURCE *owner = AllocateHandle(HANDLE_WINDOW, NULL);
    RESOURCE *unrelated = AllocateHandle(HANDLE_WINDOW, NULL);
    control(unrelated->handle, 3);
    RESOURCE *child_window = AllocateHandle(HANDLE_WINDOW, owner->handle);
    control(child_window->handle, 4);
    RESOURCE *grandchild = AllocateHandle(HANDLE_WINDOW, child_window->handle);
    control(grandchild->handle, 5);
    control(owner->handle, 6);
    const HWND unrelated_handle = unrelated->handle;
    ReleaseHandle(owner);
    assert(live_handles() == 2);
    assert(GetHandle(unrelated_handle, HANDLE_WINDOW) == unrelated);
    ReleaseHandle(unrelated);
    assert(live_handles() == 0 && owned_count == 0);
}

static void reference_counts_and_detachment(void)
{
    RESOURCE *owner = AllocateHandle(HANDLE_WINDOW, NULL);
    RESOURCE *retained = control(owner->handle, 9);
    owner->refcount++;
    retained->refcount++;
    HWND owner_handle = owner->handle;
    ReleaseHandle(owner);
    assert(owner->refcount == 1 && retained->hwndParent == owner_handle);
    ReleaseHandle(owner);
    assert(retained->refcount == 1);
    assert(retained->hwndParent == NULL);
    RESOURCE *replacement = AllocateHandle(HANDLE_WINDOW, NULL);
    assert(replacement->handle == owner_handle);
    assert(GetDlgItem(replacement->handle, 9) == NULL);
    ReleaseHandle(retained);
    ReleaseHandle(replacement);
    ReleaseHandle(NULL);
    assert(live_handles() == 0 && owned_count == 0);
}

static void allocation_failures_and_dialog_result(void)
{
    RESOURCE *first = AllocateHandle(HANDLE_CONTROL, NULL);
    RESOURCE *second = AllocateHandle(HANDLE_CONTROL, NULL);
    fail_properties = 1;
    assert(AllocateHandle(HANDLE_WINDOW, NULL) == NULL);
    assert(live_handles() == 2);
    RESOURCE *next = AllocateHandle(HANDLE_WINDOW, NULL);
    assert(next && (uintptr_t)next->handle == 3);
    ReleaseHandle(first);
    ReleaseHandle(second);
    ReleaseHandle(next);
    assert(live_handles() == 0 && owned_count == 0);
    assert(DialogBox(NULL, (LPCSTR)(uintptr_t)91, NULL, NULL) == 0);
    assert(live_handles() == 0);
    assert(DialogBox(NULL, (LPCSTR)(uintptr_t)91, NULL, dialog_proc) == 73);
    assert(live_handles() == 0 && owned_count == 0);
    RESOURCE *full[MIN_HANDLE_ENTRIES];
    for (int i = 0; i < MIN_HANDLE_ENTRIES; i++)
    {
        full[i] = AllocateHandle(HANDLE_CONTROL, NULL);
        assert(full[i]);
    }
    assert(AllocateHandle(HANDLE_CONTROL, NULL) == NULL);
    assert(DialogBox(NULL, (LPCSTR)(uintptr_t)91, NULL, dialog_proc) == -1);
    assert(live_handles() == MIN_HANDLE_ENTRIES);
    for (int i = 0; i < MIN_HANDLE_ENTRIES; i++) ReleaseHandle(full[i]);
    assert(live_handles() == 0 && owned_count == 0);
    assert(global_table->count == MIN_HANDLE_ENTRIES);
}

int main(void)
{
    repeated_dialog_lifecycles();
    nested_and_independent_owners();
    reference_counts_and_detachment();
    allocation_failures_and_dialog_result();
    free(global_table->entries);
    free(global_table);
    global_table = NULL;
    printf("PASS: 1000 dialog lifecycles; nested ownership; references; allocation failures; dialog result; %d owned allocations freed.\n", frees);
    return 0;
}

