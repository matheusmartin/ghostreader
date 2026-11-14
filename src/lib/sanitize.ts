// Inline SVG from a book file is content, not code: keep shapes and text, drop anything that can
// run script, load a resource or restyle the page.

const DROP = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed', 'style', 'link', 'image', 'audio', 'video', 'animate', 'animatemotion', 'animatetransform', 'set', 'a']);

export function sanitizeSvg(source: string): SVGSVGElement | null {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const svg = doc.documentElement;
  if (svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null;

  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (DROP.has(child.nodeName.toLowerCase())) child.remove();
      else walk(child);
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      const external = (name === 'href' || name === 'xlink:href') && !value.startsWith('#');
      if (name.startsWith('on') || name === 'style' || external || value.includes('javascript:')) el.removeAttribute(attr.name);
    }
  };
  walk(svg);
  // Size comes from the page, not from the file.
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  return document.importNode(svg, true) as unknown as SVGSVGElement;
}
