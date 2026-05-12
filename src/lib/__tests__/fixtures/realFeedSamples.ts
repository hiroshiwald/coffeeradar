// Real feed specimens captured for regression testing. Each fixture is a
// verbatim excerpt from a production roaster feed, used to keep the parser
// honest against text shapes we have actually seen in the wild.
//
// Provenance:
// - THEORY_TASTING_NOTES_ATOM: single <entry> excerpted from
//   https://theorycoffee.com/collections/coffee.atom on 2026-05-12.
//   Captured because Theory wraps every "Tasting Notes:" label in
//   <strong>...</strong> inside CDATA, which exposed the `<` boundary
//   issue in the heuristics note-capture regex.

export const THEORY_TASTING_NOTES_ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xml:lang="en" xmlns="http://www.w3.org/2005/Atom" xmlns:s="http://jadedpixel.com/-/spec/shopify">
  <id>https://theorycoffee.com/collections/all.atom</id>
  <title>Theory Coffee Roasters</title>
  <updated>2026-05-11T07:11:33-07:00</updated>
  <entry>
    <id>https://theorycoffee.com/products/10207528780071</id>
    <published>2026-05-11T07:11:33-07:00</published>
    <updated>2026-05-11T07:11:33-07:00</updated>
    <link rel="alternate" type="text/html" href="https://theorycoffee.com/products/colombia-monteblanco-geisha-cold-washed"/>
    <title>Colombia - Monteblanco Geisha (Cold Washed)</title>
    <s:type>Whole Bean Coffee</s:type>
    <s:vendor>Theory Coffee Roasters</s:vendor>
    <summary type="html"><![CDATA[<div>
<strong>Name:</strong> Monteblanco Geisha<br><strong>Country:</strong> Colombia<br><strong>Region:</strong> Huila<br><strong>Varietal:</strong> Geisha<br><strong>Process:</strong> Cold Washed<br><strong>Tasting Notes:</strong> Candied Lemon, Rose, Jasmine, Raspberry<br><br>Complex florals, sweet lemon curd, and red fruits come together in this beautifully aromatic cup.</div>]]></summary>
  </entry>
</feed>`;
