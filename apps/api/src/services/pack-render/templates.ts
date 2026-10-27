/** Geometry of a blank pouch photo: every product photo made for a template shares it, so any store's artwork lines up */
export interface PackTemplate {
  width: number;
  height: number;
  /** Where the flat artwork lands on the photo before the curve warp */
  face: { x: number; y: number; w: number; h: number };
  /** Outline of the printable film; the crimped seals and background stay as photographed */
  path: string;
  /** How strongly the filled pouch bulges across (x) and down (y), 0 = flat */
  curve: { x: number; y: number };
  /** Where the pouch's bottom seal meets the ground, for its contact shadow */
  floor: { y: number; x1: number; x2: number };
  /** The pouch and its shadow; renders are cropped to it so the pack fills a product tile like other photos */
  crop: { left: number; top: number; width: number; height: number };
}

export const PACK_TEMPLATES: Record<string, PackTemplate> = {
  // 1kg clear pillow pouch with crimped seals top and bottom, printed edge to edge; photo on a transparent background
  "pillow-1kg-full": {
    width: 1024,
    height: 1024,
    face: { x: 170, y: 100, w: 682, h: 834 },
    // Traced from the photo's silhouette, 3px inside the film edge
    path: "M174,100 L179,108 L184,120 L190,132 L192,144 L194,156 L196,168 L198,180 L201,192 L203,204 L206,216 L209,228 L211,240 L214,252 L214,264 L213,276 L214,288 L214,300 L215,312 L216,324 L216,336 L217,348 L218,360 L219,372 L220,384 L221,396 L222,408 L222,420 L223,432 L224,444 L226,456 L224,468 L223,480 L222,492 L221,504 L221,516 L221,528 L222,540 L222,552 L222,564 L222,576 L222,588 L221,600 L221,612 L221,624 L221,636 L220,648 L220,660 L219,672 L218,684 L218,696 L217,708 L217,720 L216,732 L215,744 L214,756 L212,768 L211,780 L210,792 L210,804 L209,816 L206,828 L203,840 L200,852 L197,864 L194,876 L191,888 L187,900 L183,912 L178,924 L172,934 L330,928 L700,928 L851,934 L845,924 L840,912 L836,900 L831,888 L826,876 L825,864 L823,852 L821,840 L818,828 L815,816 L813,804 L811,792 L810,780 L808,768 L806,756 L804,744 L804,732 L804,720 L804,708 L804,696 L803,684 L803,672 L802,660 L802,648 L802,636 L802,624 L802,612 L802,600 L802,588 L801,576 L801,564 L801,552 L801,540 L800,528 L799,516 L798,504 L798,492 L799,480 L800,468 L800,456 L801,444 L801,432 L801,420 L801,408 L802,396 L802,384 L802,372 L803,360 L803,348 L802,336 L802,324 L804,312 L805,300 L806,288 L806,276 L807,264 L808,252 L808,240 L808,228 L807,216 L811,204 L816,192 L819,180 L823,168 L825,156 L828,144 L830,132 L836,120 L841,108 L846,100 L700,104 L330,104 Z",
    curve: { x: 0.85, y: 0.55 },
    floor: { y: 988, x1: 170, x2: 852 },
    crop: { left: 150, top: 28, width: 724, height: 996 },
  },
};
