'use client';
import { useEffect, useState } from 'react';
import { SynapseView } from '@/components/synapse/SynapseView';

/** The synapse view on its own, playing a sample Edit run (no project, no backend). Client-only: it runs on the clock. */
export default function SynapseLab() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  return on ? <SynapseView source={{ demo: true }} onClose={() => undefined} /> : null;
}
