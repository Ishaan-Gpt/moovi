import { Skeleton } from '@/components/wait/Skeleton';

/** Settings waits as its own shape, with the halo. */
export default function Loading() {
  return <Skeleton kind="settings" />;
}
