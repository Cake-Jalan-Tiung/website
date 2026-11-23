// The shop as you find it on Jln Sukun: brick above, the sign on weathered concrete, the dark
// slatted awning, the glass front with the crowned decal, stools out front, the Butter Tteok
// board, and the rubber tree leaning in from the left. Drawn flat in the brand's colours with
// ink outlines, after the owner's photo of the shopfront.
//
// The door is a real button. Open it and the door swings in, the street falls away and you
// are at the counter: the dishes, drawn, as a menu to order from. "Back outside" returns.
import {useEffect, useId, useRef, useState} from 'react';
import {Label} from '../system/components';
import {Type} from '../system/Type';
import {Counter} from '../storefront/counter';
import type {Action, Dish} from '../storefront/model';
import {CrownedTiung} from '../marks/marks.generated';
import f from './shopfront.module.css';

type Point = readonly [number, number];
type Leaf = {x: number; y: number; angle: number; size: number; tone: 'leaf' | 'shoot'};

/** Leaves along a branch, alternating sides, larger near the trunk; now and then a new red shoot. */
function leavesAlong(from: Point, to: Point, count: number, size: number, start: number): Leaf[] {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const along = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return Array.from({length: count}, (_, i) => {
    const t = (i + 1) / (count + 1);
    const side = i % 2 === 0 ? -1 : 1;
    return {
      x: x1 + (x2 - x1) * t,
      y: y1 + (y2 - y1) * t,
      angle: along + side * (38 + (i % 3) * 8),
      size: size * (1.15 - t * 0.35),
      tone: (start + i) % 9 === 4 ? 'shoot' : 'leaf',
    };
  });
}

/** The rubber tree's branches, from the trunk outward, in the scene's units (1000 × 1100). */
const BRANCHES: readonly {from: Point; to: Point; leaves: number; size: number}[] = [
  {from: [150, 140], to: [420, 70], leaves: 6, size: 1},
  {from: [175, 290], to: [250, 250], leaves: 2, size: 0.95},
  {from: [165, 470], to: [270, 500], leaves: 3, size: 1},
  {from: [145, 620], to: [270, 690], leaves: 3, size: 1.05},
  {from: [125, 780], to: [240, 860], leaves: 3, size: 1},
  {from: [190, 40], to: [20, 110], leaves: 5, size: 1},
  {from: [160, 370], to: [0, 320], leaves: 5, size: 1.05},
  {from: [140, 560], to: [0, 520], leaves: 4, size: 1},
  {from: [130, 700], to: [0, 680], leaves: 4, size: 1.1},
  {from: [115, 900], to: [0, 980], leaves: 4, size: 1},
];
const LEAVES = BRANCHES.flatMap((branch, b) => leavesAlong(branch.from, branch.to, branch.leaves, branch.size, b * 3));

/** Spiky leaves of the plant at the bottom right, fanning from its pot. */
const BLADES = [-62, -48, -36, -24, -12, 0, 12, 26].map((angle, i) => ({angle, length: 150 + ((i * 37) % 60)}));

export function Shopfront({dishes, more}: {dishes: readonly Dish[]; more: Action}) {
  const id = useId();
  const ref = (name: string) => `${id}-${name}`;
  const [inside, setInside] = useState(false);
  // Each visit inside replays the counter's entrance.
  const [visits, setVisits] = useState(0);
  const door = useRef<HTMLButtonElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    if (!moved.current) return;
    (inside ? back : door).current?.focus({preventScroll: true});
  }, [inside]);

  const go = (next: boolean) => {
    moved.current = true;
    if (next) setVisits((n) => n + 1);
    setInside(next);
  };

  return (
    <span className={f.shopfront}>
      {/* The scene clips on purpose: going in, the street scales up past its edges. */}
      <span className={f.scene} data-inside={inside ? '' : undefined} data-fit="clips">
        <span className={f.outside} inert={inside}>
          <svg viewBox="0 0 1000 1100" className={f.street} aria-hidden>
            <defs>
              <pattern id={ref('brick')} width="96" height="44" patternUnits="userSpaceOnUse">
                <rect width="96" height="44" className={f.brick} />
                <path d="M0 0.5 H96 M0 22.5 H96 M24 0 V22 M72 22 V44" className={f.mortar} />
              </pattern>
              <path id={ref('leaf')} d="M0 0 C 26 -30, 96 -32, 132 0 C 96 32, 26 30, 0 0 Z" />
            </defs>

            {/* Brick above, white plaster to its right, a small window at the top. */}
            <rect x="0" y="0" width="1000" height="262" fill={`url(#${ref('brick')})`} />
            <rect x="880" y="0" width="120" height="262" className={f.plaster} />
            <path d="M880 0 V262" className={f.line} />
            <rect x="900" y="0" width="100" height="48" className={f.glass} />
            <path d="M900 48 H1000 M900 0 V48" className={f.line} />

            {/* The air conditioner and its bracket. */}
            <rect x="392" y="22" width="250" height="178" className={f.paper} />
            <path d="M412 44 V180 M432 44 V180 M452 44 V180 M472 44 V180 M492 44 V180 M512 44 V180 M532 44 V180" className={f.thin} />
            <rect x="560" y="40" width="64" height="142" className={f.paper} />
            <path d="M400 214 H636 M400 248 H636 M412 200 V262 M624 200 V262 M440 214 L470 248 M500 214 L530 248 M560 214 L590 248" className={f.line} />

            {/* The sign on weathered concrete, rust running down from the letters. */}
            <rect x="0" y="262" width="1000" height="178" className={f.concrete} />
            <path d="M0 262 H1000" className={f.heavy} />
            <path d="M352 352 V392 M398 354 V430 M470 352 V380 M548 354 V418 M610 352 V372 M676 354 V426 M742 352 V384 M806 354 V410 M866 352 V398 M940 300 V352" className={f.rust} />
            <text x="330" y="338" textLength="560" lengthAdjust="spacingAndGlyphs" className={f.sign}>
              CAKE JALAN TIUNG
            </text>

            {/* The dark slatted awning and the rolled-up blind. */}
            <rect x="0" y="440" width="1000" height="96" className={f.ink} />
            <path d={Array.from({length: 18}, (_, i) => `M${300 + i * 20} 446 V532`).join(' ')} className={f.slat} />
            <rect x="660" y="448" width="340" height="46" className={f.blind} />
            <path d="M660 462 H1000 M660 478 H1000" className={f.slat} />

            {/* The beam with the shop's number. */}
            <rect x="0" y="536" width="1000" height="56" className={f.beam} />
            <path d="M0 536 H1000 M0 592 H1000" className={f.line} />
            <text x="498" y="572" className={f.number}>9</text>

            {/* The neighbour's wall to the left of the glass front. */}
            <rect x="0" y="592" width="300" height="282" className={f.plaster} />
            <path d="M300 592 V874" className={f.line} />

            {/* The glass front: the room inside is dark, the glass pale. */}
            <rect x="300" y="592" width="700" height="282" className={f.ink} />
            {/* The left window, with the crowned decal. */}
            <rect x="312" y="600" width="180" height="264" className={f.glass} />
            <path d="M340 620 L300 700 M372 612 L322 712" className={f.glint} />
            <path d="M330 810 H470 M350 810 V860 M450 810 V860 M330 790 Q 400 770 470 790" className={f.thin} />
            <g transform="translate(392 600) rotate(8)">
              <CrownedTiung width={96} height={84} aria-hidden />
            </g>
            <text className={f.decal} transform="translate(330 700) rotate(14)">
              <tspan x="0" y="0">CAKE</tspan>
              <tspan x="0" y="42">JALAN</tspan>
              <tspan x="0" y="84">TIUNG</tspan>
            </text>
            <rect x="312" y="600" width="180" height="264" className={f.frame} />

            {/* The doorway: what the door reveals when it opens, warm light and the counter. */}
            <rect x="500" y="600" width="142" height="268" className={f.warm} />
            <path d="M500 800 H642 M500 800 V868 M642 800 V868" className={f.line} />
            <circle cx="532" cy="790" r="9" className={f.pink} />
            <circle cx="556" cy="792" r="7" className={f.gula} />
            <circle cx="606" cy="790" r="9" className={f.pink} />
            <path d="M571 600 V650" className={f.line} />
            <circle cx="571" cy="660" r="12" className={f.gula} />

            {/* The right window: notices, a pendant light and the cake display. */}
            <rect x="652" y="600" width="208" height="264" className={f.glass} />
            <rect x="668" y="690" width="34" height="48" className={f.paper} />
            <rect x="710" y="690" width="34" height="48" className={f.notice} />
            <path d="M820 600 V640" className={f.line} />
            <circle cx="820" cy="650" r="11" className={f.gula} />
            <rect x="742" y="758" width="104" height="80" className={f.paper} />
            <path d="M742 784 H846 M742 810 H846" className={f.thin} />
            <circle cx="762" cy="776" r="6" className={f.pink} />
            <circle cx="784" cy="776" r="6" className={f.teh} />
            <circle cx="806" cy="776" r="6" className={f.pink} />
            <circle cx="828" cy="776" r="6" className={f.teh} />
            <circle cx="770" cy="802" r="6" className={f.ube} />
            <circle cx="796" cy="802" r="6" className={f.pink} />
            <circle cx="822" cy="802" r="6" className={f.ube} />
            <path d="M700 620 L670 680 M736 614 L700 690" className={f.glint} />
            <rect x="652" y="600" width="208" height="264" className={f.frame} />

            {/* The column to the right. */}
            <rect x="860" y="592" width="140" height="282" className={f.plaster} />
            <path d="M860 592 V874 M930 600 C 960 640, 940 700, 990 720" className={f.line} />

            {/* The five-foot way, the kerb, the road. */}
            <rect x="0" y="874" width="1000" height="104" className={f.concrete} />
            <path d="M0 874 H1000" className={f.heavy} />
            <rect x="0" y="978" width="1000" height="20" className={f.paper} />
            <path d="M0 978 H1000 M0 998 H1000" className={f.line} />
            <rect x="0" y="998" width="1000" height="102" className={f.road} />

            {/* Out front on the left: a bistro table, a white chair, wooden stools, the little easel. */}
            <ellipse cx="236" cy="806" rx="58" ry="11" className={f.ink} />
            <path d="M236 806 V900 M206 904 H266" className={f.legs} />
            <path d="M140 830 V900 M140 830 H190 V900 M140 860 H190 M146 790 V830 M184 790 V830 M146 790 H184" className={f.chair} />
            <Stool x={300} y={858} />
            <Stool x={372} y={864} />
            <rect x="404" y="806" width="74" height="60" className={f.paper} />
            <path d="M404 806 L396 900 M478 806 L486 900 M441 866 V900" className={f.easel} />
            <rect x="404" y="806" width="74" height="60" className={f.frameThin} />
            <path d="M420 850 C 430 820, 456 820, 462 842" className={f.blueLine} />

            {/* Out front on the right: a green table, stools, and the board. */}
            <ellipse cx="770" cy="852" rx="54" ry="10" className={f.ais} />
            <path d="M770 852 V930 M744 934 H796" className={f.legs} />
            <Stool x={712} y={884} />
            <Stool x={832} y={888} />
            <path d="M872 1028 L890 880 H966 L984 1028" className={f.easel} />
            <rect x="884" y="888" width="88" height="122" className={f.board} />
            <text className={f.chalk} x="928" y="922">BUTTER</text>
            <text className={f.chalk} x="928" y="946">TTEOK</text>
            <path d="M896 962 H960 M896 976 H948 M896 990 H956" className={f.chalkLine} />

            {/* The spiky plant at the bottom right. */}
            <g transform="translate(940 1100)">
              {BLADES.map((blade) => (
                <path key={blade.angle} transform={`rotate(${blade.angle})`} d={`M-6 0 Q 0 ${-blade.length * 0.6} 0 ${-blade.length} Q 4 ${-blade.length * 0.6} 8 0 Z`} className={f.blade} />
              ))}
            </g>

            {/* The rubber tree leaning in from the left, over everything. */}
            <path d="M120 1100 C 150 900, 110 700, 170 520 C 210 380, 140 220, 210 0" className={f.trunk} />
            <path d={BRANCHES.map((branch) => `M${branch.from[0]} ${branch.from[1]} L${branch.to[0]} ${branch.to[1]}`).join(' ')} className={f.branch} />
            <g className={f.canopy}>
              {LEAVES.map((leaf, i) => (
                <g key={i} transform={`translate(${leaf.x.toFixed(1)} ${leaf.y.toFixed(1)}) rotate(${leaf.angle.toFixed(1)}) scale(${leaf.size.toFixed(2)})`}>
                  <use href={`#${ref('leaf')}`} className={leaf.tone === 'shoot' ? f.shoot : f.leaf} />
                  <path d="M8 0 H120" className={f.vein} />
                </g>
              ))}
            </g>
          </svg>

          <button ref={door} type="button" className={f.door} onClick={() => go(true)} aria-label="Open the door and see what is on the counter">
            <svg viewBox="0 0 142 268" aria-hidden>
              <rect x="2" y="2" width="138" height="264" className={f.wood} />
              <rect x="18" y="18" width="106" height="204" className={f.doorGlass} />
              <path d="M40 40 L24 80 M62 36 L34 110" className={f.glint} />
              <rect x="114" y="70" width="10" height="120" className={f.ink} />
              <circle cx="22" cy="140" r="4" className={f.ink} />
            </svg>
          </button>
        </span>

        <span className={f.inside} inert={!inside}>
          <button ref={back} type="button" className={f.back} onClick={() => go(false)}>
            <Label ink="blue">← Back outside</Label>
          </button>
          {visits > 0 ? <Counter key={visits} dishes={dishes} more={more} /> : null}
        </span>
      </span>
      <span className={f.hint} data-hidden={inside ? '' : undefined} aria-hidden>
        <Type role="caption" ink="secondary">
          Tap the door to step inside.
        </Type>
      </span>
    </span>
  );
}

/** A round wooden stool: seat, three legs, a ring. */
function Stool({x, y}: {x: number; y: number}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-22 4 L-26 70 M22 4 L26 70 M0 6 V72 M-24 44 H24" className={f.stoolLegs} />
      <ellipse cx="0" cy="0" rx="28" ry="9" className={f.stoolSeat} />
    </g>
  );
}
