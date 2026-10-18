// Moovi demo film: MotionEasy's clones 2 and 3 (three.js + Remotion), imported to be tailored to the demo script.
// Ref B "SaasWAVE" (16:9, 24 fps) and Ref C "Not everything has a tutorial" (9:16, 24 fps), as built in MotionEasy.
import { Composition } from "remotion";
import { SaaswaveClone, SAASWAVE_CLONE_SECONDS } from "./style3/films/SaaswaveClone";
import { SaaswaveBest, SAASWAVE_BEST_SECONDS } from "./style3/films/SaaswaveBest";
import { CClone, C_CLONE_FRAMES } from "./style3/films/CClone";
import { Beat2, BEAT2_SECONDS } from "./beat2/Beat2";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="SaaswaveClone" component={SaaswaveClone} durationInFrames={Math.round(SAASWAVE_CLONE_SECONDS * 24)} fps={24} width={1920} height={1080} />
    <Composition id="SaaswaveBest" component={SaaswaveBest} durationInFrames={Math.round(SAASWAVE_BEST_SECONDS * 24)} fps={24} width={1920} height={1080} />
    <Composition id="Beat2" component={Beat2} durationInFrames={BEAT2_SECONDS * 24} fps={24} width={1920} height={1080} />
    <Composition id="CClone" component={CClone} durationInFrames={C_CLONE_FRAMES} fps={24} width={1080} height={1920} />
  </>
);
