import { Skeleton } from '@/components/wait/Skeleton';

/** The projects page (and any route without its own) waits as its own shape, with the halo. */
export default function Loading() {
  return <Skeleton kind="dash" />;
}
