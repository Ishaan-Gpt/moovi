import React from "react";
import { Film, FilmShot } from "./kit/film";
import { RoomShot, roomPost } from "./room";
import { CardsShot, cardsPost } from "./cards";
import { SearchShot, searchPost } from "./search";
import { Overlays, TypeShots } from "./type";
import { S11, S12, Shot11, Shot12, room2Post } from "./room2";
import { StarIris, TypeShots2 } from "./type2";

// Style 3 study clone of ref A (styles/style-3/breakdowns/arsacre-launches.md), the full 27.5 s (661 frames like the ref).
// 3D shots: room (0–2.95), cards (4.0–7.04), site + search (12.708–17.2), room 3/4 left (17.5–20.9), room 3/4 right
// (20.9–22.6). The rest is DOM type (type.tsx, type2.tsx). Routing, canvas, post and audio: kit/film.tsx.
export const BUNDANCE_FRAMES = 661;
export const BUNDANCE_SECONDS = BUNDANCE_FRAMES / 24;

const SHOTS: FilmShot[] = [
  { id: "room", t0: 0, t1: 2.95, scene: (t, set) => <RoomShot t={t} room={set!} />, post: roomPost },
  { id: "cards", t0: 4.0, t1: 7.04, scene: (t) => <CardsShot t={t} />, post: cardsPost },
  { id: "search", t0: 12.708, t1: 17.23, scene: (t) => <SearchShot t={t} />, post: searchPost },
  { id: "s11", t0: S11[0], t1: S11[1], scene: (t, set) => <Shot11 t={t} room={set!} />, post: room2Post },
  { id: "s12", t0: S12[0], t1: S12[1], scene: (t, set) => <Shot12 t={t} room={set!} />, post: room2Post },
];

export const Bundance: React.FC = () => (
  <Film set="style3/room" shots={SHOTS} idlePost={searchPost} layers={[TypeShots, TypeShots2]} overlays={[Overlays, StarIris]} audio="style3/audio/mix.wav" />
);
