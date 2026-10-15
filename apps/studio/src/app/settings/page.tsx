import type { Metadata } from 'next';
import { byokMode, modelInfo, providerChoices } from '@moovi/engine';
import { requireUser } from '@/lib/session';
import { Sidebar } from '@/components/dash/Sidebar';
import { ModelForm } from '@/components/settings/ModelForm';

export const metadata: Metadata = { title: 'Your model' };
export const dynamic = 'force-dynamic';

const safeNext = (n: string | undefined) => (n && /^\/studio(\/|$|\?)/.test(n) && !n.startsWith('//') && !n.startsWith('/studio/settings') ? n : '/studio');

/** Bring your own model: the provider and key your crew thinks on. A new account lands here once, before the studio. */
export default async function Settings({ searchParams }: { searchParams: Promise<{ welcome?: string; next?: string }> }) {
  const user = await requireUser('/studio/settings', { model: false });
  const { welcome, next } = await searchParams;
  return (
    <div className="dash">
      <Sidebar user={user} current="model" />
      <main className="dash__main">
        <header className="dash__head">
          <h1 className="dash__title">{welcome ? <>One thing first: <em className="serif">your model</em></> : <>Your <em className="serif">model</em></>}</h1>
          <p className="dash__lede muted">Moovi and the crew think on a model you bring. Paste a key from any provider below; Gemini and Groq both give free keys in a minute.</p>
        </header>
        <ModelForm initial={modelInfo(user.id)} choices={providerChoices()} next={safeNext(next)} welcome={!!welcome} required={byokMode() === 'required'} />
      </main>
    </div>
  );
}
