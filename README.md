**This is a fork of RedBug312's `markdown-it-multimd-table`, used in the `bebras` toolchain.***

Below is the original README, slightly modified.

<br><hr><br>

<!-- [![GitHub Action](https://github.com/redbug312/markdown-it-multimd-table/workflows/Node.js/badge.svg)](https://github.com/redbug312/markdown-it-multimd-table/actions) -->
[![NPM version](https://img.shields.io/npm/v/markdown-it-multimd-table-ext.svg?style=flat)](https://www.npmjs.org/package/markdown-it-multimd-table-ext)
<!-- [![Coverage Status](https://coveralls.io/repos/redbug312/markdown-it-multimd-table/badge.svg?branch=master&service=github)](https://coveralls.io/github/redbug312/markdown-it-multimd-table?branch=master) -->

MultiMarkdown table syntax plugin for markdown-it markdown parser

## Intro

Markdown specs defines only the basics for tables. When users want common
features like `colspan`, they must fallback to raw HTML. And writing tables in
HTML is truly *lengthy and troublesome*.

This plugin extends markdown-it with MultiMarkdown table syntax.
[MultiMarkdown][mmd6] is an extended Markdown spec. It defines clear rules for
advanced Markdown table syntax, while being consistent with original pipe
table; [markdown-it][mdit] is a popular Markdown parser in JavaScript and
allows plugins extending itself.

[mmd6]: https://fletcher.github.io/MultiMarkdown-6/
[mdit]: https://markdown-it.github.io/

The features are provided:
- Cell spans over columns
- Cell spans over rows (optional)
- Divide rows into sections
- Multiple table headers
- Table caption
- Block-level elements such as lists, codes... (optional)
- Omitted table header (optional)
- Vertical alignment
- Overridden horizontal and vertical alignment cell by cell
- More control on lines

Noted that the plugin is not a re-written of MultiMarkdown. This plugin will
behave differently from the official compiler, but doing its best to obey rules
defined in [MultiMarkdown User's Guide][mmd6-table]. Please pose an issue if
there are weird results for sensible inputs.

[mmd6-table]: https://fletcher.github.io/MultiMarkdown-6/syntax/tables.html

## Usage

```javascript
// defaults
var md = require('markdown-it')()
            .use(require('markdown-it-multimd-table-ext'));

// full options list (equivalent to defaults)
var md = require('markdown-it')()
            .use(require('markdown-it-multimd-table-ext'), {
              multiline:  false,
              rowspan:    false,
              headerless: false,
              multibody:  true,
              autolabel:  true,
            });

md.render(/*...*/)
```

For a quick demo:
```javascript
$ mkdir markdown-it-multimd-table-ext
$ cd markdown-it-multimd-table-ext
$ npm install markdown-it markdown-it-multimd-table-ext --prefix .
$ vim test.js

    var md = require('markdown-it')()
                .use(require('markdown-it-multimd-table-ext'));

    const exampleTable =
    "|             |          Grouping           || \n" +
    "First Header  | Second Header | Third Header | \n" +
    " ------------ | :-----------: | -----------: | \n" +
    "Content       |          *Long Cell*        || \n" +
    "Content       |   **Cell**    |         Cell | \n" +
    "                                               \n" +
    "New section   |     More      |         Data | \n" +
    "And more      | With an escaped '\\|'       || \n" +
    "[Prototype table]                              \n";

    console.log(md.render(exampleTable));

$ node test.js > test.html
$ firefox test.html
```

Here's the table expected on browser:

<table>
<thead>
<tr>
<th></th>
<th align="center" colspan="2">Grouping</th>
</tr>
<tr>
<th>First Header</th>
<th align="center">Second Header</th>
<th align="right">Third Header</th>
</tr>
</thead>
<tbody>
<tr>
<td>Content</td>
<td align="center" colspan="2"><em>Long Cell</em></td>
</tr>
<tr>
<td>Content</td>
<td align="center"><strong>Cell</strong></td>
<td align="right">Cell</td>
</tr>
</tbody>
<tbody>
<tr>
<td>New section</td>
<td align="center">More</td>
<td align="right">Data</td>
</tr>
<tr>
<td>And more</td>
<td align="center" colspan="2">With an escaped '|'</td>
</tr>
</tbody>
<caption id="prototypetable">Prototype table</caption>
</table>

Noted that GitHub filters out `style` property, so the example uses `align` the
obsolete one. However it outputs `style="text-align: ..."` in actual.

## Options

### Multiline

Backslash at end merges with line content below.<br>
Feature contributed by [Lucas-C](https://github.com/Lucas-C).

```markdown
|   Markdown   | Rendered HTML |
|--------------|---------------|
|    *Italic*  | *Italic*      | \
|              |               |
|    - Item 1  | - Item 1      | \
|    - Item 2  | - Item 2      |
|    ```python | ```python       \
|    .1 + .2   | .1 + .2         \
|    ```       | ```           |
```

This is parsed below when the option enabled:

<table>
<thead>
<tr>
<th>Markdown</th>
<th>Rendered HTML</th>
</tr>
</thead>
<tbody>
<tr>
<td>
<pre><code>*Italic*
</code></pre>
</td>
<td>
<p><em>Italic</em></p>
</td>
</tr>
<tr>
<td>
<pre><code>- Item 1
- Item 2</code></pre>
</td>
<td>
<ul>
<li>Item 1</li>
<li>Item 2</li>
</ul>
</td>
</tr>
<tr>
<td>
<pre><code>```python
.1 + .2
```</code></pre>
</td>
<td>
<pre><code class="language-python">.1 + .2
</code></pre>
</td>
</tr>
</tbody>
</table>

### Rowspan

`^^` indicates cells being merged above.<br>
Feature contributed by [pmccloghrylaing](https://github.com/pmccloghrylaing).

```markdown
Stage | Direct Products | ATP Yields
----: | --------------: | ---------:
Glycolysis | 2 ATP ||
^^ | 2 NADH | 3--5 ATP |
Pyruvaye oxidation | 2 NADH | 5 ATP |
Citric acid cycle | 2 ATP ||
^^ | 6 NADH | 15 ATP |
^^ | 2 FADH2 | 3 ATP |
**30--32** ATP |||
[Net ATP yields per hexose]
```

This is parsed below when the option enabled:

<table>
<caption id="netatpyieldsperhexose">Net ATP yields per hexose</caption>
<thead>
<tr>
<th align="right">Stage</th>
<th align="right">Direct Products</th>
<th align="right">ATP Yields</th>
</tr>
</thead>
<tbody>
<tr>
<td align="right" rowspan="2">Glycolysis</td>
<td align="right" colspan="2">2 ATP</td>
</tr>
<tr>
<td align="right">2 NADH</td>
<td align="right">3–5 ATP</td>
</tr>
<tr>
<td align="right">Pyruvaye oxidation</td>
<td align="right">2 NADH</td>
<td align="right">5 ATP</td>
</tr>
<tr>
<td align="right" rowspan="3">Citric acid cycle</td>
<td align="right" colspan="2">2 ATP</td>
</tr>
<tr>
<td align="right">6 NADH</td>
<td align="right">15 ATP</td>
</tr>
<tr>
<td align="right">2 FADH2</td>
<td align="right">3 ATP</td>
</tr>
<tr>
<td align="right" colspan="3"><strong>30–32</strong> ATP</td>
</tr>
</tbody>
</table>

### Headerless

Table header can be eliminated.

```markdown
|--|--|--|--|--|--|--|--|
|♜|  |♝|♛|♚|♝|♞|♜|
|  |♟|♟|♟|  |♟|♟|♟|
|♟|  |♞|  |  |  |  |  |
|  |♗|  |  |♟|  |  |  |
|  |  |  |  |♙|  |  |  |
|  |  |  |  |  |♘|  |  |
|♙|♙|♙|♙|  |♙|♙|♙|
|♖|♘|♗|♕|♔|  |  |♖|
```

This is parsed below when the option enabled:

<table>
<tbody>
<tr>
<td>♜</td>
<td></td>
<td>♝</td>
<td>♛</td>
<td>♚</td>
<td>♝</td>
<td>♞</td>
<td>♜</td>
</tr>
<tr>
<td></td>
<td>♟</td>
<td>♟</td>
<td>♟</td>
<td></td>
<td>♟</td>
<td>♟</td>
<td>♟</td>
</tr>
<tr>
<td>♟</td>
<td></td>
<td>♞</td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
<tr>
<td></td>
<td>♗</td>
<td></td>
<td></td>
<td>♟</td>
<td></td>
<td></td>
<td></td>
</tr>
<tr>
<td></td>
<td></td>
<td></td>
<td></td>
<td>♙</td>
<td></td>
<td></td>
<td></td>
</tr>
<tr>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td>♘</td>
<td></td>
<td></td>
</tr>
<tr>
<td>♙</td>
<td>♙</td>
<td>♙</td>
<td>♙</td>
<td></td>
<td>♙</td>
<td>♙</td>
<td>♙</td>
</tr>
<tr>
<td>♖</td>
<td>♘</td>
<td>♗</td>
<td>♕</td>
<td>♔</td>
<td></td>
<td></td>
<td>♖</td>
</tr>
</tbody>
</table>

### Multibody

An empty line separates consecutive table bodies. When disabled, an empty line
always cuts off the tables.

### Autolabel

Table `id` attribute follows the table caption if not labeled. When disabled,
caption without labels cannot generate the attribute.

### Vertical Alignment

Allows setting the vertical alignment of columns with syntax embedded in the separator row.

    | Top   | Bottom | Default |
    | ^---- | v----- | ------- |

This sets the vertical alignment of the first two column to top and bottom, respectively.

### Overridden Alignment

At the beginning of a cell, you can write `[<align>]` to set the alignment of the cell. This overrides the default alignment of the column. Both the horizontal and vertical alignment can be set.

    | Col 1     | Col 2      | Col 3        | Col 4       |
    | --------- | ---------- | ------------ |------------ |
    | [^] Top   | [v] Bottom | [=] Middle   | Content     |
    | [:-] Left | [-:] Right | [:-:] Center | [-] Default |

When specifying both horizontal and vertical alignment, the horizontal alignment should be written first. The alignment specifiers can be separated by a comma or a space for better readability.

### Line Control

Whereas a simple `|` separator indicates a cell boundary, a double vertical bar `‖` in the separator row asks for a line to be drawn.

This adds a left and and right border to the table:

    | Col 1 | Col 2 | Col 3 |
    ‖ ----- | ----- | ----- ‖
    | A     | B     | C     |
    
`‖` only has an effect in the separator row and otherwise acts as a normal cell boundary; this adds no line:

    ‖ Col 1 | Col 2 | Col 3 ‖
    | ----- | ----- | ----- |
    | A     | B     | C     |

Complementarily, horizontal lines can be inserted in the middle of a table by having a line with hyphens `-` instead of actual cell contents (column boundaries are also allowed):

    ‖ Col 1 | Col 2 | Col 3 ‖
    | ----- | ----- | ----- |
    | A     | B     | C     |
    | ----- | ----- | ----- |
    | D     | E     | F     |


## Build/Contribute

Use `make browserify`. To publish your fork after updading the package name, use `npm publish`.

## Credits

* [MultiMarkdown][mmd6], Lightweight
  markup processor to produce HTML, LaTeX, and more.
* [markdown-it][mdit], Markdown parser, done right.
  100% CommonMark support, extensions, syntax plugins &amp; high speed.

## License

This software is licensed under the [MIT license][license] &copy; RedBug312, jppellet

[license]: https://opensource.org/licenses/mit-license.php
