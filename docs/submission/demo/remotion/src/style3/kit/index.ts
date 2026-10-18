// Style 3 kit: one import point for everything reusable (catalogue: styles/style-3/library/README.md).
//   import { Film, travel, pathRig, RigCamera, rigPost, TypeCard, Cursor, … } from "../kit";
// Film-specific shots, copy and timings stay in the film's own files.
export * from "../lib"; // FPS/W/H, easing (E, bez), pr, kf/kf3, rand, drift, rgba, FONT/useFonts, useRoom (baked sets), useCanvasTex, roundRect, roundedPlane/Slab
export * from "../motion"; // clocks, travel ramps, REF_RAMP, pulse, springs, ballistic/bounce/burst/tumble, floatIdle, path, stride
export * from "../rig"; // pathRig, sampledRig, orbitRig, handheld, blendRig, RigCamera, rigPost/rigBlur, lensFov, keys
export * from "../post"; // Post + PostParams (DOF, bloom, blur, flash, CA, grain, AgX, gain/lift grade)
export * from "../mesh"; // MeshGradient (2D), meshAt/paintMesh (3D backdrops), MeshKey
export * from "../assets3d"; // Blocks, Debris, Ribbon, Fabric, Shards
export * from "../products3d"; // Product3D (glossy catalogue props)
export * from "./props"; // Cursor, Headphones, ShoppingBag, Ruler, Confetti, drawEmoji
export * from "./backdrop"; // MeshBackdrop, SkyGradient
export * from "./type"; // 2D type, cards, carriers, overlays, letterbox, logos
export * from "./film"; // Film router (shot table → ThreeCanvas + Post + 2D layers + audio)
export { BRIDGE_URL, BridgeExport } from "./bridge"; // Blender bridge: dump each frame's scene to scripts/bridge-server.mjs → styles/tools/s3_bridge.py
export * from "./shots"; // shots.json rows → rig + travel ramps (VO words resolved) + post per shot
export * from "./canvas"; // PAPER palette, useImages (hold + redraw), useTex, paper grain / linen / cloth / page-edge canvases
export * from "./book"; // tabletop Desk (linen, lamp, PCSS), Book (gutter curve, close hinge, cover label), PageSheet (leaf turn), Bookmark
export * from "./popup"; // paper engineering: PopCard, VFold, PaperWord, PhonePop, Volvelle, Envelope, PullTab, Banner, TearSheet
export * from "./carry"; // bloom-carry parts: TileRow, QueryBar, LightBlade
export * from "./materials"; // mat() presets (matte/satin/gloss/candy/chrome/brushed/glass/paper/velvet/neon/screen), warmMatte, useEnv/Env
export * from "./atmo"; // Haze, Dust, BokehSprites, LightShafts, Glare, Practical, Rain
export * from "./dressing"; // crowds and set pieces: Books, Plant, Papers, Cable, Mug, Frames, Pegboard, Shelf, Keyboard, Monitor, DeskLamp, RingLight, Blinds, Bulbs, CityLights, Floor
export * from "./finish"; // the 2D finish layer: Finish (presets pastel/candy/dark/paper/card), Grain, Vignette, FINISH
export { Cursor3D, faceCamRot, velSmear } from "./cursor"; // 3D arrow cursor ("mac" / "facet"), speed smear from a path
export type { Cursor3DProps, CursorVariant } from "./cursor";
export { GlassPanel, StudioSlab, useGlassHidden } from "./glass"; // liquid glass: screen-space frost + rim lensing + sheen
export type { GlassProps, UnderSlab } from "./glass";
// generic parts that still live in film folders
export { Room } from "../room"; // a baked set from useRoom(): colour × light maps, live-lit small props, optional per-shot `dress`
export type { Dress } from "../room";
export { useAtlas, Caption } from "../ce/shared"; // video-atlas screen textures (holds the frame until decoded); VO captions
export type { CapWord } from "../ce/shared";
export { DepthLayers, FurBall, Chip, pastelBg } from "../ce/decor"; // block layers near/far, shell-fur sphere, 3D chips, blob canvas bg
export type { Layer as DepthLayer } from "../ce/cams";
