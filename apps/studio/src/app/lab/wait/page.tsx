'use client';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/wait/Skeleton';

/** Each route's waiting state on its own (?kind=dash|settings|office|door|bare), to work on its look. */
export default function WaitLab() {
  const [kind, setKind] = useState<'dash' | 'settings' | 'office' | 'door' | 'bare'>('dash');
  useEffect(() => { const k = new URLSearchParams(location.search).get('kind'); if (k === 'settings' || k === 'office' || k === 'door' || k === 'bare') setKind(k); }, []);
  return <Skeleton kind={kind} />;
}
