import type { ConsistencyFlag } from "@/lib/types";

export function partitionConsistencyFlags(flags: ConsistencyFlag[]) {
  return {
    active: flags.filter((flag) => !flag.resolved),
    resolved: flags.filter((flag) => flag.resolved),
  };
}

export function toggleConsistencyFlagResolved(
  flags: ConsistencyFlag[],
  id: string,
  resolved: boolean,
) {
  return flags.map((flag) => (flag.id === id ? { ...flag, resolved } : flag));
}
