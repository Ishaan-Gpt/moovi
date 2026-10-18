'use client';
import { useEffect, useState } from 'react';
import { OfficeWorld } from '@/components/office3d/OfficeWorld';
import { useSimulatedCrew } from '@/components/office3d/simulate';

/**
 * A lab page for the 3D office: the room on its own, played by a pretend run (no project, no engine), with a blank
 * stand-in where the chat sits (a column on the left, a sheet at the bottom on a phone) so the room is seen in the
 * space it will really have. The office in a real project takes the same props from useChat once it is wired.
 */
export default function OfficeLab() {
  const crew = useSimulatedCrew();
  const [wide, setWide] = useState(true);
  const [sheet, setSheet] = useState(0);
  const [chat, setChat] = useState(true);
  const [fps, setFps] = useState<string>('');

  useEffect(() => {
    const mq = matchMedia('(min-width: 761px)');
    const on = () => { setWide(mq.matches); setSheet(Math.min(window.innerHeight * 0.62, 560) + 8); };
    on(); mq.addEventListener('change', on); window.addEventListener('resize', on);
    return () => { mq.removeEventListener('change', on); window.removeEventListener('resize', on); };
  }, []);

  const inset = chat && wide ? 432 : 0;
  const below = wide ? 0 : chat ? sheet : 72;
  return (
    <div className="office">
      <div className="office__world">
        <OfficeWorld {...crew} inset={inset} above={wide ? 0 : 56} below={below}
          onStats={s => setFps(`${s.fps} fps · ${s.quality} · ${s.scale}×`)} />
      </div>
      {chat && <aside className={`o3-chat glass ${wide ? '' : 'o3-chat--sheet'}`} style={wide ? undefined : { height: sheet - 8 }} aria-label="Where the chat sits" />}
      <div className="o3-lab">
        <span className="glass">Simulated run · brightcafe.example</span>
        {fps && <span className="glass">{fps}</span>}
        <button type="button" className="glass" onClick={() => setChat(c => !c)}>{chat ? 'Hide the chat space' : 'Show the chat space'}</button>
      </div>
    </div>
  );
}
