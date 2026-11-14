// The book format: what a content author (person or Claude) writes in src/books/<id>.json.
// A book file holds the book's own content only: no reader highlights, notes or other personal data.
// docs/content-format.md describes every field with examples.
//
// Hierarchy:  Book → Part → Chapter → Section (optional) → Screen
//   Part     a part or volume of the book ("Part I · Human Networks"); a book without parts has one.
//   Chapter  any unit of the book's table of contents: prologue, chapter, epilogue, appendix,
//            and the guide's own overview pages (Who's who, The book in one page…).
//   Section  an optional group of screens inside a chapter ("Key concepts", "Test yourself").
//   Screen   one piece of information: what one swipe shows.

export type BookType = 'fiction' | 'reading' | 'done';

/** Colour theme, as in the book-infographic design system: front matter and overviews, then one per part. */
export type Theme = 'front' | 'p1' | 'p2' | 'p3' | 'p4' | 'p5';
export const THEMES: readonly Theme[] = ['front', 'p1', 'p2', 'p3', 'p4', 'p5'];

export interface Book {
  format: 1;
  id: string;
  type: BookType;
  title: string;
  subtitle?: string;
  author: string;
  /** Year of first publication. */
  year?: number;
  /** Edition line for the cover, only when it matters ("Portuguese translation, 2025"). */
  edition?: string;
  /** The central situation (fiction) or the whole argument (non-fiction), ≤ 35 words. */
  lead: string;
  /** Last chapter covered ("Chapter 6"), for guides written while reading. */
  upTo?: string;
  /** Demo content: the library marks it as a sample. */
  sample?: boolean;
  parts: Part[];
}

export interface Part {
  id: string;
  /** Short name: "Part I", "Volume Two", "Opening". */
  label?: string;
  /** Name the book gives the part: "Human Networks". */
  title?: string;
  theme?: Theme;
  chapters: Chapter[];
}

export interface Chapter {
  id: string;
  /** "05", "P" (prologue), "E" (epilogue), "B" (book in one page)… */
  number: string;
  /** The real title; an untitled chapter is "Chapter 7". */
  title: string;
  /** Real length (words or pages), only to size the chip on the book map. */
  length?: number;
  /** Set to false to skip the automatic chapter opener screen. */
  opener?: boolean;
  /** Use either `screens` (no sections) or `sections`. A chapter with neither is listed but not written yet. */
  screens?: Screen[];
  sections?: Section[];
}

export interface Section {
  id?: string;
  title: string;
  screens: Screen[];
}

export type Screen =
  | SummaryScreen
  | PointsScreen
  | StepsScreen
  | ListScreen
  | QuizScreen
  | TextScreen
  | ChartScreen
  | FigureScreen;

export type ScreenType = Screen['type'];

/** The point first: In short, Core idea, Thesis, Story so far, with an optional takeaway. */
export interface SummaryScreen {
  type: 'summary';
  label: string;
  text: string;
  takeaway?: { label: string; text: string };
}

/** Named items: key concepts, key points, examples, who they are. */
export interface PointsScreen {
  type: 'points';
  label: string;
  /** 'bar' (default): accent bar on the left · 'box': white boxes, for examples. */
  style?: 'bar' | 'box';
  items: { title: string; text: string; tag?: string }[];
}

/** Numbered steps: the logic, main claims. The last step is the conclusion. */
export interface StepsScreen {
  type: 'steps';
  label: string;
  steps: string[];
}

/** Rows of name and text: cast list, places, threads, how the parts connect. */
export interface ListScreen {
  type: 'list';
  label: string;
  rows: { name: string; text: string; meta?: string }[];
}

/** Test yourself / Recall: the reader taps a question to see its answer. */
export interface QuizScreen {
  type: 'quiz';
  label: string;
  questions: { q: string; a: string }[];
}

export interface TextScreen {
  type: 'text';
  label?: string;
  paragraphs: string[];
}

interface ChartBase {
  type: 'chart';
  label?: string;
  /** One line under data charts: what the marks mean. */
  caption?: string;
}

/** Data chart: horizontal bars with real numbers. `focus` marks the bar in the accent colour. */
export interface BarsChart extends ChartBase {
  chart: 'bars';
  data: { label: string; value: number; focus?: boolean }[];
}

/** Two columns side by side, row by row; `key` is the conclusion under both. */
export interface CompareChart extends ChartBase {
  chart: 'compare';
  columns: [string, string];
  rows: [string, string][];
  key?: string;
  /** Which column is the negative side, drawn grey: 0, 1, or omitted for none. */
  negative?: 0 | 1;
}

/** From a start, through groups of points, to a key conclusion: flows and argument maps. */
export interface FlowChart extends ChartBase {
  chart: 'flow';
  start?: string;
  groups: { label?: string; theme?: Theme; items: string[] }[];
  key?: string;
}

export type ChartScreen = BarsChart | CompareChart | FlowChart;
export type ChartKind = ChartScreen['chart'];

/**
 * A hand-made diagram as inline SVG, in the diagram language of the book-infographic skill
 * (classes bx, bt, bn, bi, k, ln, la, ar, ara, t1, t2, t3, tw, ta, c, e…).
 * Draw it for a phone: viewBox about 340 wide. Scripts and event attributes are removed.
 */
export interface FigureScreen {
  type: 'figure';
  label?: string;
  svg: string;
  /** Text alternative for screen readers. */
  alt: string;
  caption?: string;
}
