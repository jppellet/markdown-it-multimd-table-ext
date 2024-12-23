'use strict';
var DFA = require('./lib/dfa.js');

module.exports = function multimd_table_plugin(md, options) {
  var defaults = {
    multiline:  false,
    rowspan:    false,
    headerless: false,
    multibody:  true,
    autolabel:  true
  };
  options = md.utils.assign({}, defaults, options || {});

  /**
   * @param {*} state
   * @param {number} line
   * @returns {[ number[], boolean[] ]} [ bounds, vlines ]
   */
  function scan_bound_indices(state, line) {
    /*
     * Naming convention of positional variables
     * - list-item
     * ·········longtext······\n
     *   ^head  ^start  ^end  ^max
     */
    var start = state.bMarks[line] + state.sCount[line],
        head = state.bMarks[line] + state.blkIndent,
        end = state.skipSpacesBack(state.eMarks[line], head),
        bounds = [], vlines = [], c, pos, posjump,
        escape = false, code = false, serial = 0;

    /* Scan for valid pipe character position */
    for (pos = start; pos < end; pos++) {
      c = state.src.charCodeAt(pos);
      switch (c) {
        case 0x5c /* \ */:
          escape = true; break;
        case 0x60 /* ` */:
          posjump = state.skipChars(pos, 0x60) - 1;
          /* make \` closes the code sequence, but not open it;
             the reason is that `\` is correct code block */
          /* eslint-disable-next-line brace-style */
          if (posjump > pos) {
            if (!code) {
              if (serial === 0) { serial = posjump - pos; } else if (serial === posjump - pos) { serial = 0; }
            }
            pos = posjump;
          } else if (code || (!escape && !serial)) { code = !code; }
          escape = false; break;
        case 0x7c /* | */:
        case 0x2016 /* ‖ */:
          if (!code && !escape) {
            bounds.push(pos);
            vlines.push(c === 0x2016);
          }
          escape = false; break;
        default:
          escape = false; break;
      }
    }
    if (bounds.length === 0) return [ bounds, bounds ];

    /* Pad in newline characters on last and this line */
    if (bounds[0] > head) {
      bounds.unshift(head - 1);
      vlines.unshift(false);
    }
    if (bounds[bounds.length - 1] < end - 1) {
      bounds.push(end);
      vlines.push(false);
    }

    return [ bounds, vlines ];
  }

  /**
   * @param {*} state
   * @param {boolean} silent
   * @param {number} line
   * @returns {{ text: string, label: string } | boolean }
   */
  function table_caption(state, silent, line) {
    var meta = { text: null, label: null },
        start = state.bMarks[line] + state.sCount[line],
        max = state.eMarks[line],
        /* A non-greedy qualifier allows the label to be matched */
        capRE = /^\[(.+?)\](\[([^\[\]]+)\])?\s*$/,
        matches = state.src.slice(start, max).match(capRE);

    if (!matches) { return false; }
    if (silent) { return true; }

    meta.text = matches[1];

    if (!options.autolabel && !matches[2]) { return meta; }

    meta.label = matches[2] || matches[1];
    meta.label = meta.label.toLowerCase().replace(/\W+/g, '');

    return meta;
  }

  /**
   * @param {*} state
   * @param {boolean} silent
   * @param {number} line
   * @returns {{ bounds: number[], multiline: boolean } | boolean }
   */
  function table_row(state, silent, line) {
    var meta = { bounds: null, multiline: null, vlines: null },
        lineinfo = scan_bound_indices(state, line),
        bounds,
        start, pos, oldMax;

    bounds = lineinfo[0];

    if (bounds.length < 2) { return false; }
    if (silent) { return true; }

    meta.bounds = bounds;
    meta.vlines = lineinfo[1];

    /* Multiline. Scan boundaries again since it's very complicated */
    if (options.multiline) {
      start = state.bMarks[line] + state.sCount[line];
      pos = state.eMarks[line] - 1; /* where backslash should be */
      meta.multiline = (state.src.charCodeAt(pos) === 0x5C/* \ */);
      if (meta.multiline) {
        oldMax = state.eMarks[line];
        state.eMarks[line] = state.skipSpacesBack(pos, start);
        meta.bounds = scan_bound_indices(state, line);
        meta.vlines = meta.bounds[1];
        meta.bounds = meta.bounds[0];
        state.eMarks[line] = oldMax;
      }
    }

    return meta;
  }

  /**
   * @param {*} state
   * @param {boolean} silent
   * @param {number} line
   * @returns {{ aligns: string[], valigns: string[], wraps: boolean[], vlines: boolean[] } | boolean }
   */
  function table_separator(state, silent, line) {
    var lineinfo = scan_bound_indices(state, line),
        bounds = lineinfo[0],
        meta = { aligns: [], valigns: [], wraps: [], vlines: lineinfo[1] },
        sepRE = /^:?(\^|v)?(-+|=+):?\+?$/,
        c, text, align, first;

    /* Only separator needs to check indents */
    if (state.sCount[line] - state.blkIndent >= 4) { return false; }
    if (bounds.length === 0) { return false; }

    for (c = 0; c < bounds.length - 1; c++) {
      text = state.src.slice(bounds[c] + 1, bounds[c + 1]).trim();
      if (!sepRE.test(text)) { return false; }

      meta.wraps.push(text.charCodeAt(text.length - 1) === 0x2B/* + */);
      first = text.charCodeAt(0);
      align = (Number(first === 0x3A/* : */) << 4) |
               Number(text.charCodeAt(text.length - 1 - meta.wraps[c]) === 0x3A);
      switch (align) {
        case 0x00: meta.aligns.push('');       break;
        case 0x01: meta.aligns.push('right');  break;
        case 0x10: meta.aligns.push('left');   break;
        case 0x11: meta.aligns.push('center'); break;
      }
      align = text.charCodeAt((first === 0x3A/* : */) ? 1 : 0);
      if (align === 0x5E/* ^ */) {
        meta.valigns.push('top');
      } else if (align === 0x76/* v */) {
        meta.valigns.push('bottom');
      } else {
        meta.valigns.push('');
      }
    }
    if (silent) { return true; }
    return meta;
  }

  /**
   * @param {*} state
   * @param {boolean} silent
   * @param {number} line
   * @returns {boolean}
   */
  function table_empty(state, silent, line) {
    return state.isEmpty(line);
  }

  /**
   * @param {*} state
   * @param {boolean} silent
   * @param {number} line
   * @returns {boolean}
   */
  function table_line(state, silent, line) {
    var linetext = state.src.slice(state.bMarks[line], state.eMarks[line]).trim(),
        // check if the line is all '-' or '=' chars, allowing for optional '|' and '‖' chars
        lineRE = /^[-=\|‖]? ?[-=]+[ -=\|‖]*$/;
    return lineRE.test(linetext);
  }

  /**
   * @param {*} state
   * @param {number} startLine
   * @param {number} endLine
   * @param {boolean} silent
   * @returns {boolean}
   */
  function table(state, startLine, endLine, silent) {
    /*
     * Regex pseudo code for table:
     *     caption? header+ separator (data+ empty line)* data+ caption?
     *
     * We use DFA to emulate this plugin. Types with lower precedence are
     * set-minus from all the formers.  Noted that separator should have higher
     * precedence than header or data.
     *   |  state   | caption separator header line data empty | --> lower precedence
     *   | 0x101000 |    1        0       1     0     0    0   |
     */
    var tableDFA = new DFA(),
        grp = 0x10, mtr = -1,
        alignOverrideRE = /^\[(:-|-:|-|:-:)?[ ,]?(v|\^|=)?\] ?(.*)$/,
        match,
        token, tableToken, trToken,
        colspan, leftToken,
        rowspan, upTokens = [],
        tableLines, tgroupLines,
        tag, text, textTrimmed, range, r, c, b, t,
        halign, valign, styleParts,
        blockState;

    if (startLine + 2 > endLine) { return false; }

    /**
     * First pass: validate and collect info into table token. IR is stored in
     * markdown-it `token.meta` to be pushed later. table/tr open tokens are
     * generated here.
     */
    tableToken       = new state.Token('table_open', 'table', 1);
    tableToken.meta  = { sep: null, cap: null, tr: [] };

    tableDFA.set_highest_alphabet(0x100000);
    tableDFA.set_initial_state(0x101000 /* cap/head */);
    tableDFA.set_accept_states([
      0x100010 /* cap/data */, 0x100110 /* cap/data/line */,
      0x100111 /* cap/data/line/empty */, 0x000000 /* end */
    ]);
    tableDFA.set_match_alphabets({
      /* cap */
      0x100000: table_caption.bind(this, state, true),
      /* sep */
      0x010000: table_separator.bind(this, state, true),
      /* head */
      0x001000: table_row.bind(this, state, true),
      /* line */
      0x000100: table_line.bind(this, state, true),
      /* data */
      0x000010: table_row.bind(this, state, true),
      /* empty */
      0x000001: table_empty.bind(this, state, true)
    });
    tableDFA.set_transitions({
      /* cap/head: { cap -> head, head -> sep/head } */
      0x101000: { 0x100000: 0x001000, 0x001000: 0x011000 },
      /* head: { head -> sep/head } */
      0x001000: { 0x001000: 0x011000 },
      /* sep/head: { sep -> cap/data, head -> sep/head } */
      0x011000: { 0x010000: 0x100010, 0x001000: 0x011000 },
      /* cap/data: { cap -> end, data -> cap/data/line/empty } */
      0x100010: { 0x100000: 0x000000, 0x000010: 0x100111 },
      /* cap/data/line/empty: { cap -> end, data -> cap/data/line/empty, line -> cap/data, empty -> cap/data } */
      0x100111: { 0x100000: 0x000000, 0x000010: 0x100111, 0x000100: 0x100010, 0x000001: 0x100010 }
    });
    if (options.headerless) {
      tableDFA.set_initial_state(0x111000 /* cap/sep/head */);
      tableDFA.update_transition(0x111000,
        /* cap/sep/head: { cap -> sep/head, sep -> cap/data, head -> sep/head } */
        { 0x100000: 0x011000, 0x010000: 0x100010, 0x001000: 0x011000 }
      );
      trToken = new state.Token('tr_placeholder', 'tr', 0);
      trToken.meta = Object();  // avoid trToken.meta.grp throws exception
    }
    if (!options.multibody) {
      tableDFA.update_transition(0x100010,
        /* cap/data: { cap -> end, data -> cap/data/line } */
        { 0x100000: 0x000000, 0x000010: 0x100110 }  // disallow empty line
      );
      tableDFA.update_transition(0x100110,
        /* cap/data/line: { cap -> end, data -> cap/data/line, line -> cap/data } */
        { 0x100000: 0x000000, 0x000010: 0x100110, 0x000100: 0x100010 }
      );
    }
    /* Don't mix up DFA `_state` and markdown-it `state` */
    tableDFA.set_actions(function (_line, _state, _type) {
      // console.log(_line, _state.toString(16), _type.toString(16))  // for test
      switch (_type) {
        case 0x100000: // caption
          if (tableToken.meta.cap) { break; }
          tableToken.meta.cap       = table_caption(state, false, _line);
          tableToken.meta.cap.map   = [ _line, _line + 1 ];
          tableToken.meta.cap.first = (_line === startLine);
          break;
        case 0x010000: // separator
          tableToken.meta.sep     = table_separator(state, false, _line);
          tableToken.meta.sep.map = [ _line, _line + 1 ];
          trToken.meta.grp |= 0x01;  // previously assigned at case 0x001010
          grp               = 0x10;
          break;
        case 0x001000: // header
        case 0x000010: // data
          trToken           = new state.Token('tr_open', 'tr', 1);
          trToken.map       = [ _line, _line + 1 ];
          trToken.meta      = table_row(state, false, _line);
          trToken.meta.type = _type;
          trToken.meta.grp  = grp;
          grp               = 0x00;
          tableToken.meta.tr.push(trToken);
          /* Multiline. Merge trTokens as an entire multiline trToken */
          if (options.multiline) {
            if (trToken.meta.multiline && mtr < 0) {
              /* Start line of multiline row. mark this trToken */
              mtr = tableToken.meta.tr.length - 1;
            } else if (!trToken.meta.multiline && mtr >= 0) {
              /* End line of multiline row. merge forward until the marked trToken */
              token               = tableToken.meta.tr[mtr];
              token.meta.mbounds  = tableToken.meta.tr
                .slice(mtr).map(function (tk) { return tk.meta.bounds; });
              token.map[1]        = trToken.map[1];
              tableToken.meta.tr  = tableToken.meta.tr.slice(0, mtr + 1);
              mtr = -1;
            }
          }
          break;
        case 0x000100: // line
          trToken.meta.lineBelow = true;
          trToken.meta.grp      |= 0x01;
          grp                    = 0x10;
          break;
        case 0x000001: // empty
          trToken.meta.grp |= 0x01;
          grp               = 0x10;
          break;
      }
    });

    if (tableDFA.execute(startLine, endLine) === false) { return false; }
    // if (!tableToken.meta.sep) { return false; } // always evaluated true
    if (!tableToken.meta.tr.length) { return false; } // false under headerless corner case
    if (silent) { return true; }

    /* Last data row cannot be detected. not stored to trToken outside? */
    tableToken.meta.tr[tableToken.meta.tr.length - 1].meta.grp |= 0x01;


    /**
     * Second pass: actually push the tokens into `state.tokens`.
     * thead/tbody/th/td open tokens and all closed tokens are generated here;
     * thead/tbody are generally called tgroup; td/th are generally called tcol.
     */
    tableToken.map   = tableLines = [ startLine, 0 ];
    tableToken.block = true;
    tableToken.level = state.level++;
    state.tokens.push(tableToken);

    if (tableToken.meta.cap) {
      token          = state.push('caption_open', 'caption', 1);
      token.map      = tableToken.meta.cap.map;

      var attrs      = [];
      var capSide    = tableToken.meta.cap.first ? 'top' : 'bottom';

      /* Null is possible when disabled the option autolabel */
      if (tableToken.meta.cap.label !== null) {
        attrs.push([ 'id', tableToken.meta.cap.label ]);
      }

      /* Add caption-side inline-CSS to <caption> tag, if caption is below the markdown table. */
      if (capSide !== 'top') {
        attrs.push([ 'style', 'caption-side: ' + capSide ]);
      }

      token.attrs    = attrs;

      token          = state.push('inline', '', 0);
      token.content  = tableToken.meta.cap.text;
      token.map      = tableToken.meta.cap.map;
      token.children = [];

      token          = state.push('caption_close', 'caption', -1);
    }

    for (r = 0; r < tableToken.meta.tr.length; r++) {
      leftToken = new state.Token('td_th_placeholder', '', 0);

      /* Push in thead/tbody and tr open tokens */
      trToken = tableToken.meta.tr[r];
      // console.log(trToken.meta); // for test
      if (trToken.meta.grp & 0x10) {
        tag       = (trToken.meta.type === 0x001000) ? 'thead' : 'tbody';
        token     = state.push(tag + '_open', tag, 1);
        token.map = tgroupLines = [ trToken.map[0], 0 ];  // array ref
        upTokens  = [];
      }
      trToken.block = true;
      trToken.level = state.level++;
      state.tokens.push(trToken);

      /* Push in th/td tokens */
      for (c = 0; c < trToken.meta.bounds.length - 1; c++) {
        range = [ trToken.meta.bounds[c] + 1, trToken.meta.bounds[c + 1] ];
        text = state.src.slice.apply(state.src, range);

        if (text === '') {
          colspan = leftToken.attrGet('colspan');
          leftToken.attrSet('colspan', colspan === null ? 2 : colspan + 1);
          continue;
        }
        textTrimmed = text.trim();
        if (options.rowspan && upTokens[c] && textTrimmed === '^^') {
          rowspan = upTokens[c].attrGet('rowspan');
          upTokens[c].attrSet('rowspan', rowspan === null ? 2 : rowspan + 1);
          leftToken = new state.Token('td_th_placeholder', '', 0);
          continue;
        }

        tag         = (trToken.meta.type === 0x001000) ? 'th' : 'td';
        token       = state.push(tag + '_open', tag, 1);
        token.map   = trToken.map;
        token.attrs = [];

        halign = tableToken.meta.sep.aligns[c];
        valign = tableToken.meta.sep.valigns[c];

        match = alignOverrideRE.exec(textTrimmed);
        if (match) {
          if (match[1]) {
            // halign
            switch (match[1]) {
              case ':-': halign = 'left'; break;
              case '-:': halign = 'right'; break;
              case ':-:': halign = 'center'; break;
              case '-': default: halign = ''; break;
            }
          }
          if (match[2]) {
            // valign
            switch (match[2]) {
              case '^': valign = 'top'; break;
              case 'v': valign = 'bottom'; break;
              case '=': default: valign = 'middle'; break;
            }
          }
          // text
          text = match[3];
        }

        styleParts = [];
        if (halign) {
          styleParts.push('text-align:' + halign);
        }
        if (valign) {
          styleParts.push('vertical-align:' + valign);
        }
        if (tableToken.meta.sep.vlines[c]) {
          styleParts.push('border-left:1px solid');
        }
        if (tableToken.meta.sep.vlines[c + 1]) {
          styleParts.push('border-right:1px solid');
        }
        if (trToken.meta.lineBelow) {
          styleParts.push('border-bottom:1px solid');
        }

        if (styleParts.length) {
          token.attrs.push([ 'style', styleParts.join(';') ]);
        }
        if (tableToken.meta.sep.wraps[c]) {
          token.attrs.push([ 'class', 'extend' ]);
        }

        leftToken = upTokens[c] = token;

        /* Multiline. Join the text and feed into markdown-it blockParser. */
        if (options.multiline && trToken.meta.multiline && trToken.meta.mbounds) {
          // Pad the text with empty lines to ensure the line number mapping is correct
          text = new Array(trToken.map[0]).fill('').concat([ text.trimRight() ]);
          for (b = 1; b < trToken.meta.mbounds.length; b++) {
            /* Line with N bounds has cells indexed from 0 to N-2 */
            if (c > trToken.meta.mbounds[b].length - 2) { continue; }
            range = [ trToken.meta.mbounds[b][c] + 1, trToken.meta.mbounds[b][c + 1] ];
            text.push(state.src.slice.apply(state.src, range).trimRight());
          }
          blockState = new state.md.block.State(text.join('\n'), state.md, state.env, []);
          blockState.level = trToken.level + 1;
          // Start tokenizing from the actual content (trToken.map[0])
          state.md.block.tokenize(blockState, trToken.map[0], blockState.lineMax);
          for (t = 0; t < blockState.tokens.length; t++) {
            state.tokens.push(blockState.tokens[t]);
          }
        } else {
          token          = state.push('inline', '', 0);
          token.content  = text.trim();
          token.map      = trToken.map;
          token.level    = trToken.level + 1;
          token.children = [];
        }

        token = state.push(tag + '_close', tag, -1);
      }

      /* Push in tr and thead/tbody closed tokens */
      state.push('tr_close', 'tr', -1);
      if (trToken.meta.grp & 0x01) {
        tag = (trToken.meta.type === 0x001000) ? 'thead' : 'tbody';
        token = state.push(tag + '_close', tag, -1);
        tgroupLines[1] = trToken.map[1];
      }
    }

    tableLines[1] = Math.max(
      tgroupLines[1],
      tableToken.meta.sep.map[1],
      tableToken.meta.cap ? tableToken.meta.cap.map[1] : -1
    );
    token = state.push('table_close', 'table', -1);

    state.line = tableLines[1];
    return true;
  }

  md.block.ruler.at('table', table, { alt: [ 'paragraph', 'reference' ] });
};

/* vim: set ts=2 sw=2 et: */
