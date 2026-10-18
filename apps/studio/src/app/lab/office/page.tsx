'use client';
import { useEffect, useState } from 'react';
import { OfficeWorld } from '@/components/office3d/OfficeWorld';
import { useSimulatedCrew } from '@/components/office3d/simulate';

/** The office's set on its own, for working on it without a project: a blank panel stands where the chat sits. */
export default function OfficeLab() {
  const crew = useSimulatedCrew();
  const [wide, setWide] = useState(true);
  const [sheet, setSheet] = useState(0);
  useEffect(() => {
    const mq = matchMedia('(min-width: 761px)');
    const on = () => { setWide(mq.matches); setSheet(Math.min(window.innerHeight * 0.62, 560) + 8); };
    on(); mq.addEventListener('change', on); window.addEventListener('resize', on);
    return () => { mq.removeEventListener('change', on); window.removeEventListener('resize', on); };
  }, []);
  return (
    <div className="office">
      <div className="office__world">
        <OfficeWorld {...crew} inset={wide ? 432 : 0} above={wide ? 0 : 56} below={wide ? 0 : sheet} />
      </div>
      <aside className="chat glass" style={wide ? undefined : { left: 8, right: 8, top: 'auto', bottom: 8, width: 'auto', height: sheet - 8 }} aria-hidden="true" />
    </div>
  );
}
