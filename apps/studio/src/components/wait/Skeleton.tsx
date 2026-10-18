import { HaloLoader } from '@moovi/ui';

type Kind = 'dash' | 'settings' | 'office' | 'door' | 'bare';

/**
 * What a studio route shows from its first paint until its data is ready: the page's own shape in soft ice blocks
 * (so nothing jumps when it arrives) with the halo stepping at its centre. No words.
 */
export function Skeleton({ kind }: { kind: Kind }) {
  const halo = <HaloLoader size={72} base="/studio" className="sk__halo" />;
  if (kind === 'bare') return <main className="sk sk--bare">{halo}</main>;
  if (kind === 'office') return (
    <main className="sk sk--office" aria-busy="true">
      <div className="sk__room" />
      <aside className="sk__chat glass">
        <i className="sk__b sk__b--title" /><i className="sk__b sk__b--line" /><i className="sk__b sk__b--line sk__b--short" />
        <span className="sk__grow" /><i className="sk__b sk__b--input" />
      </aside>
      <div className="sk__stage">{halo}</div>
    </main>
  );
  if (kind === 'door') return (
    <main className="sk sk--door" aria-busy="true">
      <div className="sk__door-art" />
      <div className="sk__door-side">
        <div className="sk__card glass"><i className="sk__b sk__b--title" /><i className="sk__b sk__b--field" /><i className="sk__b sk__b--field" /><i className="sk__b sk__b--btn" /></div>
      </div>
      <div className="sk__float">{halo}</div>
    </main>
  );
  return (
    <div className="dash sk" aria-busy="true">
      <aside className="rail sk__rail"><i className="sk__b sk__b--mark" /><i className="sk__b sk__b--nav" /><i className="sk__b sk__b--nav" /><span className="sk__grow" /><i className="sk__b sk__b--nav" /></aside>
      <main className="dash__main sk__main">
        <div className="dash__head"><i className="sk__b sk__b--h1" /><i className="sk__b sk__b--lede" /></div>
        {kind === 'dash'
          ? <ul className="grid sk__grid" role="list">{Array.from({ length: 6 }, (_, i) => <li key={i}><i className="sk__b sk__b--card" /></li>)}</ul>
          : <div className="sk__form"><i className="sk__b sk__b--panel" /><i className="sk__b sk__b--panel sk__b--low" /></div>}
        <div className="sk__float">{halo}</div>
      </main>
    </div>
  );
}
