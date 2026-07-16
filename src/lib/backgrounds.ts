export interface DefaultBackground {
  id: string;
  label: string;
  url: string;
}

export const LIGHT_BACKGROUNDS: DefaultBackground[] = [
  { id: "aurora", label: "Aurora", url: "/backgrounds/aurora.png" },
  { id: "peaks", label: "Peaks", url: "/backgrounds/peaks.png" },
  { id: "meadow", label: "Meadow", url: "/backgrounds/meadow.png" },
  { id: "haze", label: "Haze", url: "/backgrounds/haze.png" },
  { id: "dunes", label: "Dunes", url: "/backgrounds/dunes.png" },
];

export const DARK_BACKGROUNDS: DefaultBackground[] = [
  { id: "midnight", label: "Midnight", url: "/backgrounds/midnight.png" },
  { id: "nebula", label: "Nebula", url: "/backgrounds/nebula.png" },
  { id: "forest", label: "Forest", url: "/backgrounds/forest.png" },
  { id: "ocean", label: "Ocean", url: "/backgrounds/ocean.png" },
  { id: "ember", label: "Ember", url: "/backgrounds/ember.png" },
];

export const LIGHT_BACKGROUND_IDS = new Set(["none", ...LIGHT_BACKGROUNDS.map((b) => b.id)]);
export const DARK_BACKGROUND_IDS = new Set(["none", ...DARK_BACKGROUNDS.map((b) => b.id)]);

/** URL to render for the active theme's background, or null for none. */
export function resolveBackgroundUrl(
  isDark: boolean,
  backgroundLight: string,
  backgroundDark: string,
): string | null {
  const set = isDark ? DARK_BACKGROUNDS : LIGHT_BACKGROUNDS;
  const id = isDark ? backgroundDark : backgroundLight;
  return set.find((b) => b.id === id)?.url ?? null;
}
