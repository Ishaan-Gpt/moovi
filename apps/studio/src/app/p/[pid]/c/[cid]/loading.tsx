import { Skeleton } from '@/components/wait/Skeleton';

/** The office waits as itself (the room and the chat), with the halo. */
export default function Loading() {
  return <Skeleton kind="office" />;
}
