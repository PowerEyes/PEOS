
// ─────────────────────────────────────────────────────────────────────────────
// Lens Recommendation Engine
// Based on international prescribing guidelines:
//   WHO Quality Standards for Spectacles (IRIS 2021)
//   AAO Clinical Practice Guidelines (2024)
//   AOP Position on Blue Light (2023)
//   SE-based Index Selection (Even Realities Clinical Guide)
//   Presbyopia Classification — Ophthalmology Journal 2021
// ─────────────────────────────────────────────────────────────────────────────

export type EyeRx = {
  sph: number | null;
  cyl: number | null;
  axis: number | null;
  add: number | null;
};

export type RxValues = {
  od: EyeRx;
  os: EyeRx;
  pd_far: number | null;
  pd_near: number | null;
};

export type Lifestyle = {
  usage: "recommend"|"single"|"progressive"|"reading"|"bifocal"|"non_rx";
  screen_hours: number;    // hours per day on screens
  outdoor: "rarely"|"sometimes"|"frequent";
  driving: boolean;
  sports: boolean;
  age: number;             // patient age in years
};

export type Flag = {
  severity: "info"|"warning"|"critical";
  title: string;
  message: string;
  action?: string;
};

export type CoatingRec = {
  id: string;
  name: string;
  reason: string;
  priority: "essential"|"recommended"|"optional";
};

export type LensRec = {
  // Lens type
  lensType: "single_vision"|"progressive"|"bifocal"|"reading"|"plano";
  lensTypeLabel: string;
  lensTypeReason: string;
  lensTypeIcon: string;

  // Index
  recommendedIndex: number;       // e.g. 1.67
  indexLabel: string;             // "1.67 High Index"
  indexReason: string;            // plain-language explanation
  indexSavings?: string;          // "~40% thinner than standard"

  // Astigmatism note
  hasSignificantCyl: boolean;
  cylNote?: string;

  // Flags (warnings, clinical alerts)
  flags: Flag[];

  // Coatings ranked by priority
  coatings: CoatingRec[];

  // Derived numbers (for display/debugging)
  seOd: number;
  seOs: number;
  dominantSe: number;    // whichever eye has higher absolute SE
  addPower: number;
  anisometropia: number;
  effectiveIndex: number; // SE value used for index decision

  // Package filter — passed to the database query
  packageFilter: {
    design: string;
    minIndex: number;
    preferredCoatings: string[];
  };
};

// ─── Helper functions ─────────────────────────────────────────────────────────
const num = (v: number | null, fallback = 0) => v ?? fallback;

function sphericalEquivalent(eye: EyeRx): number {
  return num(eye.sph) + num(eye.cyl) / 2;
}

function absMax(a: number, b: number): number {
  return Math.abs(a) >= Math.abs(b) ? a : b;
}

// ─── Main recommendation function ────────────────────────────────────────────
export function recommendLenses(rx: RxValues, lifestyle: Lifestyle): LensRec {
  // ── 1. Compute SE and derived values ──────────────────────────────────────
  const seOd = sphericalEquivalent(rx.od);
  const seOs = sphericalEquivalent(rx.os);
  const dominantSe = absMax(seOd, seOs);          // eye with higher absolute power drives index
  const addPower = Math.max(num(rx.od.add), num(rx.os.add));
  const maxCyl = Math.max(Math.abs(num(rx.od.cyl)), Math.abs(num(rx.os.cyl)));
  const anisometropia = Math.abs(seOd - seOs);
  const { age, screen_hours, outdoor, driving, sports, usage } = lifestyle;
  const isKids = age > 0 && age < 16;
  const isMyope = dominantSe < 0;
  const isHyperope = dominantSe > 0;

  const flags: Flag[] = [];

  // ── 2. Clinical flags (what a real optician would flag immediately) ────────

  // HIGH POWER — most important visual flag
  if (Math.abs(dominantSe) >= 6.0) {
    flags.push({
      severity: "warning",
      title: "High Prescription Power",
      message: `Your prescription of ${dominantSe.toFixed(2)}D is in the high range. Standard lenses at this power would be noticeably thick and heavy.`,
      action: "1.67 High Index or 1.74 Ultra High Index is strongly recommended — lenses will be 30–40% thinner."
    });
  } else if (Math.abs(dominantSe) >= 4.0) {
    flags.push({
      severity: "info",
      title: "Moderate-High Power",
      message: `Your prescription of ${dominantSe.toFixed(2)}D will benefit from a higher-index lens for thinner, lighter glasses.`,
      action: "1.60 or 1.67 Mid/High Index is recommended."
    });
  }

  // SIGNIFICANT ASTIGMATISM
  if (maxCyl >= 2.5) {
    flags.push({
      severity: "warning",
      title: "Significant Astigmatism",
      message: `You have significant astigmatism (CYL: ${maxCyl.toFixed(2)}D). This adds to effective lens thickness.`,
      action: "An aspherical or free-form lens design provides sharper peripheral vision. Larger frames should be avoided."
    });
  } else if (maxCyl >= 1.5) {
    flags.push({
      severity: "info",
      title: "Astigmatism Detected",
      message: `Your prescription includes astigmatism correction (CYL: ${maxCyl.toFixed(2)}D).`,
      action: "An anti-reflective coating is especially beneficial to reduce halos and glare with astigmatic prescriptions."
    });
  }

  // ANISOMETROPIA (big difference between eyes)
  if (anisometropia >= 2.0) {
    flags.push({
      severity: "warning",
      title: "Different Powers in Each Eye",
      message: `Your right eye (${seOd.toFixed(2)}D) and left eye (${seOs.toFixed(2)}D) have a ${anisometropia.toFixed(2)}D difference. This is called anisometropia.`,
      action: "Free-form aspherical lenses are recommended to minimise image size differences between eyes and reduce visual fatigue."
    });
  }

  // KIDS — safety first
  if (isKids) {
    flags.push({
      severity: "critical",
      title: "Child Under 16 — Safety Lenses Required",
      message: "Children's lenses must be impact-resistant to protect against injury from sports, play and accidents.",
      action: "We recommend Polycarbonate (1.59) or Trivex material — shatter-resistant and 10× stronger than standard plastic."
    });
  }

  // PLUS POWER + HIGH — UV risk
  if (isHyperope && dominantSe > 3.0) {
    flags.push({
      severity: "info",
      title: "Plus Power — UV Protection Important",
      message: "High plus lenses can focus UV radiation onto the macula. UV400 protection is clinically recommended for your prescription.",
      action: "Ensure your lenses include UV400 protection or a UV-blocking coating."
    });
  }

  // EARLY PRESBYOPIA WARNING (age 38-42, no ADD yet)
  if (age >= 38 && age <= 45 && addPower === 0 && usage !== "non_rx" && usage !== "reading") {
    flags.push({
      severity: "info",
      title: "Pre-Presbyopic Age Range",
      message: `At age ${age}, most people begin noticing difficulty reading small print up close. This is called presbyopia.`,
      action: "If you are experiencing any difficulty reading, mention it during your next eye test. You may benefit from progressive lenses."
    });
  }

  // ── 3. Lens TYPE decision ─────────────────────────────────────────────────
  let lensType: LensRec["lensType"];
  let lensTypeLabel: string;
  let lensTypeReason: string;
  let lensTypeIcon: string;

  if (usage === "non_rx") {
    lensType = "plano"; lensTypeLabel = "Non-Prescription Lenses"; lensTypeIcon = "🕶️";
    lensTypeReason = "Zero-power lenses for style, UV protection and blue light filtering. Cosmetically identical to prescription lenses.";

  } else if (usage === "reading") {
    lensType = "reading"; lensTypeLabel = "Reading Glasses (Near Vision)"; lensTypeIcon = "📖";
    lensTypeReason = "Single vision lenses optimised for near work at approximately 40 cm. Ideal for reading, phone use and close-up tasks.";

  } else if (addPower > 0 || usage === "progressive" || usage === "bifocal") {
    // Presbyopia decision tree (based on Ophthalmology Journal 2021 severity classification)
    lensTypeIcon = "🔭";
    if (usage === "bifocal" || (addPower > 2.25 && usage !== "progressive")) {
      lensType = "bifocal"; lensTypeLabel = "Bifocal Lenses";
      lensTypeReason = `ADD power of +${addPower.toFixed(2)}D. Bifocals provide a generous near reading segment below and a wide distance zone above. Many patients with high ADD power prefer bifocals for a larger, more comfortable reading area.`;
    } else if (addPower < 1.25 && addPower > 0) {
      lensType = "progressive"; lensTypeLabel = "Progressive Lenses (Mild ADD)"; lensTypeIcon = "🔭";
      lensTypeReason = `Early presbyopia with ADD +${addPower.toFixed(2)}D. Progressive lenses correct distance, intermediate (computer/dashboard) and near (reading) in one seamless lens with no visible line. Mild ADD adapts easily.`;
    } else if (addPower >= 1.25 && addPower <= 2.0) {
      lensType = "progressive"; lensTypeLabel = "Progressive Lenses (Moderate ADD)"; lensTypeIcon = "🔭";
      lensTypeReason = `ADD +${addPower.toFixed(2)}D indicates moderate presbyopia. Progressive lenses give you clear vision at all distances. We recommend a premium free-form design for this ADD power — wider vision zones and faster adaptation.`;
    } else {
      lensType = "progressive"; lensTypeLabel = "Progressive Lenses (High ADD)"; lensTypeIcon = "🔭";
      lensTypeReason = `ADD +${addPower.toFixed(2)}D is in the advanced presbyopia range. A premium progressive with a wide near zone is recommended. If you have tried progressives before and struggled, bifocal may be worth discussing with your optometrist.`;
    }
    // Office worker supplement
    if ((screen_hours >= 6 || outdoor === "rarely") && lensType === "progressive") {
      flags.push({
        severity: "info",
        title: "Consider Office Progressive Lenses",
        message: `You spend ${screen_hours}+ hours daily on screens. Office/occupational progressive lenses have a wider intermediate (computer) zone than standard progressives.`,
        action: "Discuss Office Progressives with our optometrist at the store."
      });
    }

  } else {
    // Single Vision (default for all distance corrections)
    lensType = "single_vision"; lensTypeLabel = "Single Vision Lenses"; lensTypeIcon = "👓";
    if (Math.abs(dominantSe) <= 0.5 && maxCyl <= 0.25) {
      lensTypeReason = "Your prescription is very mild. Single vision lenses will provide crisp, clear distance vision.";
    } else if (isMyope) {
      lensTypeReason = `Myopia (nearsightedness) of ${dominantSe.toFixed(2)}D. Single vision lenses correct your distance vision so objects far away appear sharp and clear.`;
    } else {
      lensTypeReason = `Hyperopia (farsightedness) of +${dominantSe.toFixed(2)}D. Single vision lenses reduce the strain your eyes exert when focusing and give comfortable, clear vision.`;
    }
  }

  // ── 4. Lens INDEX decision (the core clinical recommendation) ─────────────
  // For kids: override to polycarbonate 1.59 regardless of power
  // For progressives: add +0.75D to effective SE (near zone adds thickness)
  // CYL contribution: each 1.0D of CYL adds ~0.2D to effective thickness at rim

  const progressiveBoost = (lensType === "progressive" || lensType === "bifocal") ? 0.75 : 0;
  const cylContribution = maxCyl * 0.2;
  const effectiveIndex = Math.abs(dominantSe) + progressiveBoost + cylContribution;

  let recommendedIndex: number;
  let indexLabel: string;
  let indexReason: string;
  let indexSavings: string | undefined;

  if (isKids) {
    recommendedIndex = 1.59; indexLabel = "1.59 Polycarbonate";
    indexReason = `For children under 16, polycarbonate is the clinical standard. It is 10× more impact-resistant than CR-39 and significantly reduces injury risk. Lighter than standard plastic at the same power.`;
    indexSavings = "Impact-resistant — 10× stronger than standard";
  } else if (effectiveIndex <= 2.25) {
    recommendedIndex = 1.56; indexLabel = "1.56 Standard Index";
    indexReason = `Your prescription of ${dominantSe.toFixed(2)}D is in the mild range. Standard 1.56 index (CR-39 plastic) gives excellent optical clarity and is the most cost-effective choice for your power. Lens thickness will be comfortable.`;
  } else if (effectiveIndex <= 3.75) {
    recommendedIndex = 1.60; indexLabel = "1.60 Mid Index";
    indexReason = `For your prescription of ${dominantSe.toFixed(2)}D, 1.60 Mid Index gives you lenses approximately 20% thinner and lighter than standard. You will notice the difference in frame appearance and daily comfort.`;
    indexSavings = "~20% thinner than standard";
  } else if (effectiveIndex <= 5.75) {
    recommendedIndex = 1.67; indexLabel = "1.67 High Index";
    indexReason = `Your prescription of ${dominantSe.toFixed(2)}D is in the high range. 1.67 High Index lenses are approximately 30% thinner and lighter than standard. At this power, standard lenses would be noticeably thick and heavy — high index is the right clinical choice.`;
    indexSavings = "~30% thinner and lighter";
  } else {
    recommendedIndex = 1.74; indexLabel = "1.74 Ultra High Index";
    indexReason = `Your prescription of ${dominantSe.toFixed(2)}D is very high. 1.74 Ultra High Index is our thinnest available lens — up to 40% thinner than standard. At this power level, this is the only practical choice for a comfortable, aesthetically acceptable lens.`;
    indexSavings = "Up to 40% thinner — our thinnest lens";
  }

  // ── 5. Coating recommendations (ranked by clinical priority) ─────────────
  const coatings: CoatingRec[] = [];

  // Anti-Reflective — ALWAYS essential (no exceptions)
  coatings.push({
    id: "ar", name: "Anti-Reflective Coating", priority: "essential",
    reason: `Essential for all lenses. Eliminates ghost reflections from screens, headlights and overhead lighting. ${recommendedIndex >= 1.67 ? "Particularly important for high-index lenses which have a higher refractive surface — without AR, they can look like mirrors." : "Dramatically improves visual clarity and reduces eye fatigue indoors."}`
  });

  // Scratch Resistant — essential for kids, recommended for all
  coatings.push({
    id: "scratch", name: "Scratch Resistant Coating", priority: isKids ? "essential" : "recommended",
    reason: isKids ? "Children's lenses are exposed to far more physical wear. A hard coat doubles the lifespan of the lens." : "Micro-scratches accumulate over time and degrade optical clarity. A hard coat significantly extends lens life."
  });

  // Blue Light — recommended based on screen time
  if (screen_hours >= 4) {
    coatings.push({
      id: "blue_light", name: "Blue Light Filter", priority: "recommended",
      reason: `You spend ${screen_hours}+ hours per day on screens. While current evidence (AOP 2023, AAO 2024) does not confirm blue light causes eye disease, many patients report reduced digital eye fatigue and better sleep quality when blue light is filtered from 4+ hours of screen use. This is a comfort-based recommendation.`
    });
  } else if (screen_hours >= 2) {
    coatings.push({
      id: "blue_light", name: "Blue Light Filter", priority: "optional",
      reason: `You use screens for ${screen_hours} hours daily. A blue light filter is optional at this usage level but some patients find it improves comfort during extended computer sessions.`
    });
  }

  // Photochromic — recommended for outdoor/driving users
  if (outdoor === "frequent" || driving) {
    coatings.push({
      id: "photochromic", name: "Photochromic (Transitions)", priority: outdoor === "frequent" ? "recommended" : "optional",
      reason: `You spend significant time outdoors${driving ? " and drive regularly" : ""}. Photochromic lenses automatically darken in sunlight and clear indoors — eliminating the need for separate prescription sunglasses and providing constant UV protection.`
    });
  }

  // UV400
  if (isHyperope || outdoor !== "rarely" || recommendedIndex >= 1.67) {
    coatings.push({
      id: "uv400", name: "UV400 Protection", priority: isHyperope && dominantSe > 3.0 ? "essential" : "recommended",
      reason: isHyperope
        ? "Plus-power lenses can act as a magnifier for UV rays, increasing macular exposure. UV400 protection is clinically important for your prescription type."
        : "UV400 blocks 100% of UVA and UVB rays. High-index lenses transmit slightly more UV — a UV coating is especially advisable."
    });
  }

  // Driving tint (if driving but not photochromic)
  if (driving && outdoor !== "frequent") {
    coatings.push({
      id: "driving_tint", name: "Driving Tint (Light Amber 10%)", priority: "optional",
      reason: "A very light amber tint enhances road contrast while driving, reduces glare from wet road surfaces and is within legal limits for daytime driving vision."
    });
  }

  // Sports — impact
  if (sports) {
    coatings.push({
      id: "impact", name: "Impact Resistant Treatment", priority: "recommended",
      reason: "For sports and active use, impact resistance significantly reduces the risk of lens shattering on ball impact, elbow contact or falls. Particularly important for racquet sports, cricket and cycling."
    });
  }

  // ── 6. CYL note for display ───────────────────────────────────────────────
  const hasSignificantCyl = maxCyl >= 1.5;
  const cylNote = hasSignificantCyl
    ? `Your astigmatism (CYL ${maxCyl.toFixed(2)}D) adds to effective lens thickness. The index recommendation already accounts for this.`
    : undefined;

  return {
    lensType, lensTypeLabel, lensTypeReason, lensTypeIcon,
    recommendedIndex, indexLabel, indexReason, indexSavings,
    hasSignificantCyl, cylNote,
    flags, coatings,
    seOd, seOs, dominantSe, addPower, anisometropia, effectiveIndex,
    packageFilter: {
      design: lensType,
      minIndex: recommendedIndex,
      preferredCoatings: coatings.filter(c => c.priority === "essential").map(c => c.id),
    },
  };
}

// ── Utility: rank packages from DB against the recommendation ─────────────────
export function rankPackages(packages: any[], rec: LensRec): any[] {
  return packages
    .map(pkg => {
      let score = 0;
      // Design match is most important
      if (pkg.design === rec.lensType) score += 100;
      // Index match
      const pkgIndexes = (pkg.available_indexes || []).map(Number);
      if (pkgIndexes.includes(rec.recommendedIndex)) score += 50;
      else if (pkgIndexes.some((idx: number) => idx >= rec.recommendedIndex)) score += 20;
      // Included coatings overlap
      const pkgCoatings = pkg.included_coatings || pkg.coatings || [];
      for (const coating of rec.coatings.filter(c => c.priority === "essential")) {
        if (pkgCoatings.includes(coating.id)) score += 10;
      }
      return { ...pkg, _score: score, _isRecommended: score >= 100 };
    })
    .sort((a, b) => b._score - a._score);
}

// ── Utility: short summary label for the recommendation card ──────────────────
export function recSummaryLines(rec: LensRec): string[] {
  const lines: string[] = [];
  lines.push(`${rec.lensTypeIcon} ${rec.lensTypeLabel}`);
  lines.push(`${rec.indexLabel}${rec.indexSavings ? ` — ${rec.indexSavings}` : ""}`);
  if (rec.hasSignificantCyl) lines.push("Aspherical design recommended for your astigmatism");
  const essentialCoats = rec.coatings.filter(c => c.priority === "essential").map(c => c.name).join(" + ");
  if (essentialCoats) lines.push(essentialCoats);
  return lines;
}
