/* Browser diagnostics for the repaired compatibility runtime.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
#include "handle.h"

int TabbozHandleCount(void)
{
    int count = 0;
    if (global_table != NULL) {
        for (int i = 0; i < global_table->count; ++i) {
            if (global_table->entries[i].refcount > 0) ++count;
        }
    }
    return count;
}

int TabbozHandleCapacity(void)
{
    return global_table != NULL ? global_table->count : 0;
}
