import { HaloLoader } from '@moovi/ui';

/** Every route change in the studio waits on the halo, and only the halo. */
export default function Loading() {
  return (
    <main className="route-wait">
      <HaloLoader size={72} base="/studio" />
    </main>
  );
}
