/*
 * Novantotto
 * Copyright (c) 2024 Andrea Bonomi
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "novantotto.h"
#include "property.h"
#include "handle.h"
#include "debug.h"

#define MIN_HANDLE_ENTRIES 100

HANDLE_TABLE *global_table;

//*******************************************************************
// Allocate a new handle table
//*******************************************************************

HANDLE_TABLE *AllocateHandleTable(int count)
{
    HANDLE_TABLE *table;

    if (count < MIN_HANDLE_ENTRIES)
    {
        count = MIN_HANDLE_ENTRIES;
    }
    if (!(table = calloc(1, sizeof(HANDLE_TABLE))))
    {
        DEBUG_PRINTF("AllocateHandleTable calloc failed\n");
        return NULL;
    }
    table->count = count;
    if ((table->entries = calloc(count, sizeof(*table->entries))))
    {
        return table;
    }
    else
    {
        DEBUG_PRINTF("AllocateHandleTable calloc failed\n");
        free(table);
        return NULL;
    }
}

//*******************************************************************
// Allocate an handle
//*******************************************************************

RESOURCE *AllocateHandle(HandleType type, HWND hwndParent)
{
    if (!global_table)
    {
        DEBUG_PRINTF("AllocateHandle global_table is null\n");
        if (!(global_table = AllocateHandleTable(0)))
        {
            return NULL;
        }
    }
    for (int i = 0; i < global_table->count; i++)
    {
        RESOURCE *h = &global_table->entries[i];
        if (h->refcount == 0)
        {
            // A table slot can previously have held a different resource type.
            // Never carry freed pointers or control/window state into its reuse.
            memset(h, 0, sizeof(*h));
            h->type = type;
            h->hwndParent = hwndParent;
            if (type == HANDLE_WINDOW)
            {
                h->window.fEnd = FALSE;
                h->window.dialogResult = 0;
                h->props = AllocateProperties();
                if (h->props == NULL)
                {
                    DEBUG_PRINTF("AllocateHandle failed\n");
                    // h is an entry in the shared table, not a separately
                    // allocated object. Leave the unused slot available.
                    memset(h, 0, sizeof(*h));
                    return NULL;
                }
            }
            h->refcount++;
            h->handle = (HWND)(i + 1);
            DEBUG_PRINTF("AllocateHandle id=%d type=%d\n", (int)h->handle, h->type);
            return (HANDLE)h;
        }
    }
    DEBUG_PRINTF("AllocateHandle table full\n");
    return NULL;
}

//*******************************************************************
// Release an handle
//*******************************************************************

void ReleaseHandle(HANDLE p)
{
    RESOURCE *h = (RESOURCE *)p;
    if (h == NULL || h->refcount == 0)
    {
        return;
    }
    DEBUG_PRINTF("ReleaseHandle id=%d refcount=%d type=%d\n", (int)h->handle, h->refcount, h->type);
    if (--h->refcount != 0)
    {
        return;
    }

    // hwndParent stores a numeric HWND, not a RESOURCE pointer. Preserve that
    // identifier before invalidating the slot so its children can be found.
    HWND handle = h->handle;
    HandleType type = h->type;
    LPSTR className = h->lpClassName;
    PROPERTIES *props = h->props;
    memset(h, 0, sizeof(*h));

    if (type == HANDLE_WINDOW && handle != NULL && global_table != NULL)
    {
        for (int i = 0; i < global_table->count; i++)
        {
            RESOURCE *child = &global_table->entries[i];
            if (child->refcount > 0 && child->hwndParent == handle)
            {
                // Release the parent's ownership through the same destructor,
                // including nested windows, class strings, and properties.
                // A separately retained reference must not keep a stale parent.
                child->hwndParent = NULL;
                ReleaseHandle(child);
            }
        }
    }
    free(className);
    if (props != NULL)
    {
        FreeProperties(props);
    }
}

//*******************************************************************
// Retrieve a control handle
//*******************************************************************

HWND GetDlgItem(HWND hDlg, int nIDDlgItem)
{
    for (int i = 0; i < global_table->count; i++)
    {
        RESOURCE *res = &global_table->entries[i];
        if ((res->refcount > 0) && (hDlg == res->hwndParent) && (nIDDlgItem == res->control.nIDDlgItem))
        {
            return res->handle;
        }
    }
    DEBUG_PRINTF("GetDlgItem %d - not found\n", nIDDlgItem);
    return NULL;
}

//*******************************************************************
// Get an handle by index
//*******************************************************************

RESOURCE *GetHandle(HANDLE handle, HandleType type)
{
    RESOURCE *h;
    int       index = (int)handle;
    if (!global_table || index < 1 || index > global_table->count)
    {
        return NULL;
    }
    h = &global_table->entries[index - 1];
    if (h->refcount == 0)
    {
        return NULL;
    }
    else if (type == HANDLE_ANY)
    {
        return h;
    }
    else if (h->type == type)
    {
        return h;
    }
    return NULL;
}
