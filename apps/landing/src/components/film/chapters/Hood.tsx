'use client';
import { Chapter } from '../Chapter';
import { paper } from '@/lib/content';

/** "Under the hood": the real architecture on a sheet of paper. Moovi steps aside and reads over your shoulder. */
export function Hood() {
  return (
    <Chapter name="hood" flow
      front={
        <div className="hood shell">
          <h2 className="duo" data-reveal><span className="duo__lead">{paper.heading[0]}</span><span className="duo__big">{paper.heading[1]}</span></h2>
          <article className="paper__sheet" data-reveal>
            <header className="paper__head">
              <span className="t-mono">Technical note · v0.1</span>
              <h3 className="paper__title">{paper.title}</h3>
            </header>
            <div className="paper__grid">
              <div className="paper__abstract"><h4 className="t-sub2">Abstract</h4><p>{paper.abstract}</p></div>
              <figure className="paper__fig" aria-label="Architecture: brief to director to crew, all reading and writing one graph">
                <Arch />
                <figcaption className="t-mono">Fig. 1. Agents share nothing but the graph.</figcaption>
              </figure>
              {paper.columns.map(c => (
                <div key={c.h} className="paper__col"><h4 className="t-sub2">{c.h}</h4><ul>{c.items.map(i => <li key={i}>{i}</li>)}</ul></div>
              ))}
              <pre className="paper__cypher t-mono"><code>{paper.cypher}</code></pre>
            </div>
            <footer className="paper__foot"><span className="t-mono paper__soon">{paper.soon}</span></footer>
          </article>
        </div>
      } />
  );
}

function Arch() {
  const xs = [70, 160, 250, 340, 430];
  return (
    <svg viewBox="0 0 500 300" className="paper__svg">
      <g className="arch-box"><rect x="190" y="12" width="120" height="34" rx="17" /><text x="250" y="34">Brief</text></g>
      <path className="arch-line" d="M250 46V70" />
      <g className="arch-box arch-box--lead"><rect x="170" y="70" width="160" height="40" rx="20" /><text x="250" y="95">Moovi · director</text></g>
      {xs.map((x, i) => <path key={i} className="arch-line" d={`M250 110 C 250 130, ${x} 126, ${x} 146`} />)}
      {['Scribe', 'Cutter', 'Beat', 'Lens', 'Keeper'].map((n, i) => (
        <g key={n} className="arch-box"><rect x={xs[i]! - 40} y="146" width="80" height="30" rx="15" /><text x={xs[i]} y="166">{n}</text></g>
      ))}
      {xs.map((x, i) => <path key={`g${i}`} className="arch-line arch-line--dot" d={`M${x} 176 C ${x} 196, 250 192, 250 212`} />)}
      <g className="arch-box arch-box--graph"><rect x="150" y="212" width="200" height="36" rx="18" /><text x="250" y="235">FalkorDB graph</text></g>
      <path className="arch-line" d="M250 248V266" />
      <g className="arch-box"><rect x="150" y="266" width="200" height="28" rx="14" /><text x="250" y="285">Render engines</text></g>
    </svg>
  );
}
