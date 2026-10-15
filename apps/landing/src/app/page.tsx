import { WorldStage } from '@/components/film/WorldStage';
import { ScrollCue } from '@/components/chrome/ScrollCue';
import { Hero } from '@/components/film/chapters/Hero';
import { Problem } from '@/components/film/chapters/Problem';
import { Directed } from '@/components/film/chapters/Directed';
import { Crew } from '@/components/film/chapters/Crew';
import { How } from '@/components/film/chapters/How';
import { Memory } from '@/components/film/chapters/Memory';
import { Styles } from '@/components/film/chapters/Styles';
import { Hood } from '@/components/film/chapters/Hood';
import { Finale } from '@/components/film/chapters/Finale';

/**
 * The landing page is a short film scrubbed by your scroll. Moovi acts in every chapter:
 * meets you, swallows a prompt box, splits into his crew, passes the work down the line, remembers,
 * becomes every kind of video, and waves goodbye with the whole crew.
 */
export default function Home() {
  return (
    <>
      <WorldStage />
      <ScrollCue />
      <Hero />
      <Problem />
      <Directed />
      <Crew />
      <How />
      <Memory />
      <Styles />
      <Hood />
      <Finale />
    </>
  );
}
