/* eslint-disable no-magic-numbers -- canonical UI constants for opacity, scale, and proportions */

/**
 * UI-specific constants for opacity, alpha values, and proportional scales.
 * These values are used in color gradients, overlays, and other visual effects.
 */

/** Color gradient opacity/alpha values for heatmaps and layered visualizations */
export const GRADIENT_OPACITY_MIN = 0;
export const GRADIENT_OPACITY_LOW = 0.2;
export const GRADIENT_OPACITY_MED_LOW = 0.4;
export const GRADIENT_OPACITY_MEDIUM = 0.5;
export const GRADIENT_OPACITY_MED_HIGH = 0.6;
export const GRADIENT_OPACITY_HIGH = 0.8;
export const GRADIENT_OPACITY_VERY_HIGH = 0.95;
export const GRADIENT_OPACITY_MAX = 1;

/** Proportional scales for layout and spacing (fraction of full size) */
export const PROPORTION_QUARTER = 0.25;
export const PROPORTION_THIRD = 0.33;
export const PROPORTION_HALF = 0.5;
export const PROPORTION_TWO_THIRDS = 0.67;
export const PROPORTION_THREE_QUARTERS = 0.75;

/** Additional UI proportions for specific use cases */
export const CONTRAST_THRESHOLD = 0.34;
export const SECONDARY_TEXT_OPACITY = 0.8;
export const DISABLED_ELEMENT_OPACITY = 0.5;
export const MODAL_OVERLAY_OPACITY = 0.6;

/** Pixel-based layout constants for UI elements */
export const GRID_SPACING_UNIT_PX = 8;
export const BORDER_RADIUS_SM_PX = 4;
export const BORDER_RADIUS_MD_PX = 6;
export const BORDER_RADIUS_LG_PX = 12;

/** Number formatting constants */
export const DECIMAL_PLACES_2 = 2;
export const DECIMAL_PLACES_3 = 3;
export const DECIMAL_PLACES_4 = 4;

/** File size constants (bytes) */
export const CSV_CHUNK_SIZE_BYTES = 1024 * 1024; // 1 MB chunk for CSV parsing
