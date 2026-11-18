import type { EntryKindPort } from "../core/platform-ports/file-system-port.ts";
import { textsDisk } from "../mechanisms/audit/runner/walker-disk.ts";
import type { WalkerDisk } from "../mechanisms/audit/runner/walker-piece.ts";

export const EMPTY_DISK: WalkerDisk = textsDisk({ root: "/repo", texts: {} });

export const ABSENT_ENTRY_KIND: EntryKindPort = { kindOf: () => "absent" };
