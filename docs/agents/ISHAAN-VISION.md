# How Moovi should work: Ishaan's words

Owner: Ishaan, recorded by Claude 1 · 2026-10-17. Saved word for word as Ishaan says it, in parts, until he says
he's done. Nothing here has been answered or acted on yet. Discussion and the proposal come after.

## Part 1: the goal, and two ways in

I love the visualization, but then it seems very messed up and kind of not as organized and useful as I want it to
be. I want you to listen to me and then prepare a proposal visualization, which would basically maybe an
enhancement or a slight rebuild, whatever is needed.

So first of all, what is our goal? Our goal is that Moovi is an agentic AI video editor which performs better than
every other source in the market right now. Our aim number two, anybody who has no idea what to edit and how to
edit, when they come and simply just tell their idea or give a video, they should be able to get a video worthy of
posting on social media without them being worried about the prompt.

Now, how do I want Moovi to work? Right now, I don't know. I see four or five different paths, but I want it to be
simple. So, hypothetically, let's say we have no styles right now. Imagine we have no styles, no library. Then what
and how would Moovi work? Somebody would come and there will be two options. They either give a video to edit or
they ask us to generate a video. Then if they give us to generate a video, they will tell us what kind of video
they want to generate. A showreel, a UI launch, a task explainer. We will have four to five types. Okay, you want to
generate a video of this type. And we will have, let's say, a style associated with them. Cool. When they ask us to
edit a video, they will simply give us a video and they will expect it, it will be edited in a full-fledged format.
So that is step one.

## Part 2: why styles, and the level to beat

Okay. So next, we have styles. Why do we have styles? We want styles because everybody can generate a video using
Opus 5.5. There are different levels of getting a video. Level 1, they just give Opus their repository and then
they are like, okay, generate me a launch video. Level 2 is they download a skill and then they use that skill to
generate a video. Level 3, they have somebody who has made a proper full-fledged process prompt and then they use
that prompt and they tailor this for my video. What we want is level 4. Understand, right? Right now, our outputs
are not even feeling like level 1. That is what I am a little worried about. They have to be far better than level
1 to 2 and 3.

Why was I giving you different references and styles? Now, kind of all of them were given for the same reason to
develop taste. But then I kind of made it hard for you to get taste and you are simply just scrolling and you kind
of not using it in the way I want you to.

First of all, I don't really want to see editing videos and generating videos as two completely different
functions. I would say editing a video is just an enhancement of for generating a video pipeline. I will tell you
why I feel that. First, let us talk in depth about generating a video.

## Part 3: the video types, a skill and a library per style, agents, taste, tools, editing, captions, sync

Okay, so we have to be clear with exactly what kind of videos are we generating. So whenever a user is coming to a
website, we are usually catering to these users. Number one, launch video. Number two, show reel. Number three,
something related to his brand which he can post on social media, but not under a launch video or a show reel kind
of. Number three, a SaaS explainer video. Number four, UI morph. Number five, kinetic. So this is what is coming in
my mind. I also have some styles present in my graph. I want you to like map these to those, and then we can have a
final list of stuff. Okay, these are the ones which we will offer as a video. Now, like I believe for SaaS, uh, I
mean, okay, so these were the styles, and then we will master these styles so that whenever he is choosing, he will
get a kind of what he wants.

Then, next step was our perfecting every style. Now, first, for every single style, we are supposed to have a skill.
You can call that skill a workflow. I don't know what I should call, but there has to be some skill which is
extremely good at generating videos at exactly that style with a level of premiumness which is not present in the
market. And along with that, there will be a library. There is definitely already a huge library out there, but for
every style, there has to be a specific its own library. Or if from the graph, some components, effects, stuff will
be marked. But this is for this library. I mean style.

Now, the role of agents. I somehow believe that I have many agents right now, but there are just many setup of
agents. The agents in the website, the agents in Claude. They're all different and they're all working, but they are
not necessarily giving me the edge or the extra advantage of using them than if I'm using a single agent. So I need
to feel and ensure that they are not decorative and they add meaningful work.

Now for library, what I wanted was that I have always seen that for generating a video, the main thing which you
need is a reference. And I can give you 5 reference, 10 reference, something like that. But then after a point, I
have to give you taste. So I thought of making the library where I break them all into their very fundamental
aspects. And I have a library of captions, text, sound, components, effects, animations, and etc. etc. which I
mentioned. But I still don't feel it is very well mapped to every single video that is being generated or edited. It
has to be mapped with every single one of them. Ishaan motion skill. That has to be mapped with every single of them.
So that it knows that okay, in Ishaan motion skill, there has to be different sub skills. It has to be a tree type
motion skill. So that that is what will provide the taste of my videos.

And we have certain tools, and those tools also have to be used extremely well. Like we have tools like generating
images with Claude, extracting images and clips, getting a website brand assets and colors, etc. Watch and see what
tools you have. So those tools also have to be mapped to every single of the video that is being generated, and they
don't have to be secluded. There, there has to be just a decision tree that if it is good to use these tools, we
will use these tools.

Now what I see that video editing is just an enhancement over video generating, because in video editing we will
have a pre-processing layer where we cut the abrupt parts, but wherever we are cutting, we ensure to have some
transition or some animation or some motion graphic in there, so we don't have to cut parts together that it looks
abrupt. We have a processing layer for color grading. We can have similar pre-processing layers. Then we kind of
have the video editing skill. Even for this, I was trying to give you many references of how a good video is edited.
Vignesh also gave. But I still believe we are not very good well enough. Even the clones are not well mapped. They
are just mapped in terms of palette and stuff. The taste is not mapped. I mean, video editing also, I believe it's
not very tough. It's just a video is given. There has to be some preset captions which you will have to decide for
videos. And they will be dynamic captions. We will have components burned into the video. We have some 20 video
effects. We will expand them to 30, 40. And then we will use those video effects, some of them in every video. In
every video, there will be cuts where there will be motion graphics, animations. So there are certain presets which
we have to learn and organize them in a very good manner. Use Mixkit when needed. You understand, right? Use Claude
images when needed. So that is the thing.

And there has to be a very incremental and deterministic way of improving video output both in generation and
editing with time. Like it should feel that okay, if I'm giving new references, you you have to tell me, okay, I
have made this style, I have just one reference, give me 5 more or something like that. Okay, next I want to study
from this, rate it, we will do some cross testing. And finally, I will be at a stage where my only work is to just
keep giving you better references so that we keep getting better with time.

Then we have to map stuff, like if you have SFX. So every SFX has to be mapped with exactly when it has to be used.
Like click for typing, whoosh. Every SFX has to be mapped, you know. Same for captions also. We don't have to
randomly, first of all, I don't know if we are picking captions from 11 styles or captions easy. I made captions
easy so that it's easier. But I guess we will have to make some caption presets or something like that as global.
You have to suggest what we have to do so that we have a kind of deterministic premium captions appearing only in
the videos which are generated. And of course, we have to do this in the form of a pipeline so that it does not take
a hell lot of time to generate a new video.

And secondly, I don't know what is happening in the website, but I feel the website chat box is pretty flooded up.
And the agents which are working in the website and the agents which are working here, they have to be in sync. If I
have 10 agents, I need to have 10 agents in the website. If I have 5 there, I have to need to have 5 there. We have
to sync them. Right now, if I'm seeing the graph, I'm feeling so hell confused. It has to be so much more organized
than it is right now. So I need you to give your best and show the proposed final elaborate decision tree in same
manner, so that we are able to achieve the output we are looking for.

## Part 4: voice, the writer, floor rules, one theme, my own video, chat edits, two brains

I like the new proposal. It still feels incomplete. First of all, I do not see voice anywhere. I have 63 voices. I
don't see that anywhere.

Also, the current script which you are making, I find it very boring. For every single place where you have to write
the script, I want you to have my writer agent be really advanced. An example of a script template is: hook, problem,
solution, climax, CTA, something like that. I want those presets for every style. Everything that is generated by
the script should:

* not look AI-generated
* be humanized
* be impactful
* be trending it should be easily graspable by the user. Right now, some looks and some scripts are just so weird
  that they just don't connect with me. I would not like to watch that for 50 seconds, so the script has to be made
  in a way that it will be watched for however long it is..
* Then there have to be rules for everything: minimum rules. Like right now, many a times captions appear and
  disappear without being me be able to read. That must not happen. Transitions appear in between without me being
  able to see what is happening. That must not happen. There has to be certain basic finesse, premium or basic rules
  for everything that is going on. Then, secondly, many a times I see that a whole slide has just text and no UI
  components. And the text is also very small, which makes it look so abrupt. So that must not happen. Then many a
  time some components are there which are basically stale. Like they have no image inside. So that is also extremely
  weird. Then the entire video has to follow a certain theme. Even if you are picking from one or two, three styles,
  it has to be in the same theme kind of. You understand, right? They must look interrelated.

Then, secondly, let me also tell you my plan that finally, very soon, I want to record a video of myself and then I
want to edit it completely end-to-end using Moovi in my website. So by that time, I want it to be good enough. So if
there is anything missing in the architecture right now, which has to be there, because my ambition is high. I will
upload a raw video. It has to upscale, it has to grade, it has to pick up the cuts. I may prompt it like pick this
one. I may give it reference to images, videos, and then I may ask it to edit certain stuff. Right now I see if in a
website, if I asked it to edit certain stuff, it does not do that. It simply recreates the entire video in same style
with no relation to what I said. Now every video is purposefully made in code and editable so that I can edit it in
my prompt box in website very easily. I should be able to give references, taste, edit exactly what I want using
prompts. Because you know it is the lovable of videos, so it has to feel like that.

Secondly, I also want to say that I will have two main branches of this. People who are using open source APIs and
people who will be connecting their Claude code using our website. Now for sure Claude code will have Opus 5.5 which
will be able to create certain stuff which open APIs like Grok or Open Router cannot. So that also has to be seen as a
part of my architecture. How my pipeline behaves when it is given uh, open source API, that it is more deterministic
in that part, and how when it is given Claude Opus or something of that sort, then how it is more creative in that
sense. Point that we use to allow some local relationship status.

Update and again give final.
