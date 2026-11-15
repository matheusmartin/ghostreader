// The book format: what a content author (person or Claude) writes in src/books/<id>.json.
// A book file holds the book's own content only: no reader highlights, notes or other personal data.
// docs/content-format.md describes every field with examples.
//
// Hierarchy:  Book → Part → Chapter → Section (optional) → Screen
//   Part     a part or volume of the book ("Part I · Human Networks"); a book without parts has one.
//   Chapter  any unit of the book's table of contents: prologue, chapter, epilogue, appendix.
//            Only the book's own: a guide adds no overview chapter of its own.
//   Section  an optional group of screens inside a chapter ("Key concepts", "Test yourself").
//   Screen   one piece of information: what one swipe shows. In the PDF, one block.
//
// The same file makes the app and the PDF. `only: "pdf"` marks detail for the PDF alone
// (a longer synopsis, the full cast); `only: "app"` marks a screen the PDF leaves out.

export type BookType = 'fiction' | 'reading' | 'done';

/**
 * How the guide summarises, for a reader who comes back to a book after a pause (skill:
 * references/styles.md). map: diagrams first · recap: the story so far, in words · recall: questions
 * before answers · layers: one line, then a paragraph, then the detail. Default: map.
 */
export type Style = 'map' | 'recap' | 'recall' | 'layers';
export const STYLES: readonly Style[] = ['map', 'recap', 'recall', 'layers'];

/** Where a screen or section shows: in the app only, or in the PDF only. Default: both. */
export type Only = 'app' | 'pdf';

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
  /** How the guide summarises (see Style). Default: map. */
  style?: Style;
  /**
   * The guide this file belongs to. A guide is written in all four styles, one file each, with the
   * id "<guide>-<style>"; the library shows them as one tile with a style choice.
   */
  guide?: string;
  /** Demo content: the library marks it as a sample. */
  sample?: boolean;
  /** Where the content comes from. Not shown to the reader. */
  source?: Source;
  parts: Part[];
}

export interface Source {
  /** "book-file": written from the book itself (EPUB, PDF, text); "summaries": from summaries of the book. */
  kind: 'book-file' | 'summaries';
  /** "EPUB", "PDF", "Project Gutenberg text"… */
  file?: string;
  /** Date the guide was written or last regenerated (YYYY-MM-DD). */
  written?: string;
  /** Version of the ghostwriter-book skill that wrote it. */
  skill?: string;
}

export interface Part {
  id: string;
  /** The book's short name for the part: "Part I", "Volume Two". Leave out for a prologue or epilogue outside the parts. */
  label?: string;
  /** Name the book gives the part: "Human Networks". */
  title?: string;
  chapters: Chapter[];
}

export interface Chapter {
  id: string;
  /** "05", "P" (prologue), "E" (epilogue), "A1" (appendix)… */
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
  only?: Only;
  screens: Screen[];
}

export type Screen =
  | SummaryScreen
  | PointsScreen
  | StepsScreen
  | ListScreen
  | QuizScreen
  | TextScreen
  | ScenesScreen
  | ChartScreen
  | FigureScreen;

export type ScreenType = Screen['type'];

interface ScreenBase {
  only?: Only;
}

/** The point first: In short, Core idea, Thesis, Story so far, with an optional takeaway. */
export interface SummaryScreen extends ScreenBase {
  type: 'summary';
  label: string;
  text: string;
  takeaway?: { label: string; text: string };
}

/** Named items: key concepts, key points, examples, who they are. */
export interface PointsScreen extends ScreenBase {
  type: 'points';
  label: string;
  /** 'bar' (default): accent bar on the left · 'box': white boxes, for examples. */
  style?: 'bar' | 'box';
  items: { title: string; text: string; tag?: string }[];
}

/** Numbered steps: the logic, main claims. The last step is the conclusion. */
export interface StepsScreen extends ScreenBase {
  type: 'steps';
  label: string;
  steps: string[];
}

/** Rows of name and text: cast list, places, threads, how the parts connect. */
export interface ListScreen extends ScreenBase {
  type: 'list';
  label: string;
  rows: { name: string; text: string; meta?: string }[];
}

/** Test yourself / Recall: the reader taps a question to see its answer. */
export interface QuizScreen extends ScreenBase {
  type: 'quiz';
  label: string;
  questions: { q: string; a: string }[];
}

export interface TextScreen extends ScreenBase {
  type: 'text';
  label?: string;
  paragraphs: string[];
}

/**
 * Fiction: the scenes of a chapter and who is in each one. The app shows a chart (one row per
 * person, one column per scene) and then the scenes as a numbered list; the PDF shows both.
 * Scene text weaves in the time and the place: "{That night} Maude waits in [the kitchen]."
 */
export interface ScenesScreen extends ScreenBase {
  type: 'scenes';
  label?: string;
  /** Rows of the chart, top to bottom. Put people who meet next to each other. `tag`: "New". */
  people: { name: string; tag?: string }[];
  scenes: Scene[];
}

export interface Scene {
  /** One or two sentences with one {when} and one [where]. */
  text: string;
  /** People in the scene. */
  with: string[];
  /** People there only at a distance: by letter or phone, overheard, asleep. Never just talked about. */
  off?: string[];
  /** The turning point of the chapter (one scene). */
  key?: boolean;
}

interface ChartBase extends ScreenBase {
  type: 'chart';
  label?: string;
  /** One line under the chart: what the marks mean. */
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
  groups: { label?: string; items: string[] }[];
  key?: string;
}

/** Events or stages in order, with the time the book gives. One `key`: the turning point. */
export interface TimelineChart extends ChartBase {
  chart: 'timeline';
  items: { when: string; title?: string; text: string; key?: boolean }[];
}

/**
 * Who or what connects to whom: a cast map (fiction) or a concept map (non-fiction).
 * `centre` (1–2 names) sits in the middle; the first one is the key element. `nodes` sit on a
 * ring around it, in order (keep a group together). Links join any two names.
 */
export interface NetworkChart extends ChartBase {
  chart: 'network';
  centre: string[];
  nodes: { name: string; note?: string; tag?: string }[];
  links: { from: string; to: string; label?: string; arrow?: boolean }[];
}

/** Fiction: where each story thread appears, chapter by chapter. */
export interface ThreadsChart extends ChartBase {
  chart: 'threads';
  /** Column labels: the chapter numbers covered ("1", "2"…, "P", "E"). */
  columns: string[];
  threads: { name: string; text?: string; appears: string[]; major?: string[] }[];
}

/** A loop that feeds itself: 3–6 steps, the last leads back to the first. One `key` node. */
export interface CycleChart extends ChartBase {
  chart: 'cycle';
  nodes: { title: string; text?: string; key?: boolean }[];
  /** Short note in the middle of the loop. */
  centre?: string;
}

/** Items compared on features: a dot for yes, a dash for no. `focus` tints a row. */
export interface MatrixChart extends ChartBase {
  chart: 'matrix';
  columns: string[];
  rows: { label: string; cells: boolean[]; focus?: boolean }[];
  key?: string;
}

/** One situation, 2–4 possible outcomes. `key`: the outcome the book argues for. */
export interface BranchesChart extends ChartBase {
  chart: 'branches';
  start: string;
  options: { title: string; text?: string; key?: boolean; negative?: boolean }[];
}

/** Nested levels, outer ring first; the innermost ring is the key element. */
export interface LayersChart extends ChartBase {
  chart: 'layers';
  rings: { title: string; text?: string }[];
}

export type ChartScreen =
  | BarsChart
  | CompareChart
  | FlowChart
  | TimelineChart
  | NetworkChart
  | ThreadsChart
  | CycleChart
  | MatrixChart
  | BranchesChart
  | LayersChart;
export type ChartKind = ChartScreen['chart'];

/**
 * A hand-made diagram as inline SVG, in the app's diagram language
 * (classes bx, bt, bn, bi, k, ln, la, ar, ara, t1, t2, t3, tw, ta, c, e…). Maps come from the
 * skill's map script. Draw it for a phone: viewBox about 340 wide. Scripts and event attributes
 * are removed.
 */
export interface FigureScreen extends ScreenBase {
  type: 'figure';
  label?: string;
  svg: string;
  /** Text alternative for screen readers. */
  alt: string;
  caption?: string;
}
