'use client';
import { useEffect, useState } from 'react';
import { SynapseView } from '@/components/synapse/SynapseView';
import type { Layout } from '@/components/synapse/model';

/** The synapse view on its own, playing a sample Edit run (no project, no backend): ?layout=hubs|lanes. */
export default function SynapseLab() {
  const [layout, setLayout] = useState<Layout | undefined>(undefined);
  const [ready, setReady] = useState(false);
  useEffect(() => { const l = new URLSearchParams(location.search).get('layout'); if (l === 'hubs' || l === 'lanes') setLayout(l); setReady(true); }, []);
  if (!ready) return null;
  return <SynapseView source={{ demo: true }} initialLayout={layout} onClose={() => undefined} />;
}
