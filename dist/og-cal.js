var OgCal = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/og-cal.js
  var og_cal_exports = {};
  __export(og_cal_exports, {
    init: () => init
  });

  // src/util/images.js
  var DEFAULT_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp"];
  function buildImagePattern(extensions) {
    const ext = extensions.join("|");
    return new RegExp(`(?:^|\\s)(https?:\\/\\/\\S+\\.(?:${ext})(?:\\?\\S*)?)(?:\\s|$)`, "gi");
  }
  function extractImage(description, config) {
    if (!description) return { image: null, images: [], description };
    const extensions = config && config.imageExtensions || DEFAULT_IMAGE_EXTENSIONS;
    const pattern = buildImagePattern(extensions);
    const images = [];
    let cleaned = description;
    let match;
    while ((match = pattern.exec(description)) !== null) {
      images.push(match[1]);
    }
    for (const img of images) {
      cleaned = cleaned.replace(img, "").trim();
    }
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();
    return { image: images[0] || null, images, description: cleaned };
  }

  // src/util/links.js
  function handleAt(url) {
    try {
      const path = new URL(url).pathname.replace(/\/+$/, "");
      const handle = path.split("/").filter(Boolean).pop();
      return handle && !handle.includes(".") ? handle : null;
    } catch {
      return null;
    }
  }
  var DEFAULT_PLATFORMS = [
    { pattern: /eventbrite\.com/i, label: "RSVP on Eventbrite" },
    { pattern: /docs\.google\.com\/forms/i, label: "Fill Out Form" },
    { pattern: /goo\.gl\/maps|maps\.app\.goo\.gl|google\.com\/maps/i, label: "View on Map" },
    { pattern: /zoom\.us/i, label: "Join Zoom" },
    { pattern: /meet\.google\.com/i, label: "Join Google Meet" },
    { pattern: /instagram\.com/i, labelFn: (url) => {
      const h = handleAt(url);
      return h ? `Follow @${h} on Instagram` : "View on Instagram";
    } },
    { pattern: /facebook\.com|fb\.com/i, labelFn: (url) => {
      const h = handleAt(url);
      return h ? `${h} on Facebook` : "View on Facebook";
    } },
    { pattern: /(?:twitter\.com|x\.com)/i, labelFn: (url) => {
      const h = handleAt(url);
      return h ? `Follow @${h} on X` : "View on X";
    } },
    { pattern: /reddit\.com/i, labelFn: (url) => {
      const h = handleAt(url);
      return h ? `r/${h} on Reddit` : "View on Reddit";
    } },
    { pattern: /youtube\.com|youtu\.be/i, label: "Watch on YouTube" },
    { pattern: /tiktok\.com/i, labelFn: (url) => {
      const h = handleAt(url);
      return h ? `@${h} on TikTok` : "View on TikTok";
    } },
    { pattern: /linkedin\.com/i, label: "View on LinkedIn" },
    { pattern: /discord\.gg|discord\.com/i, label: "Join Discord" },
    { pattern: /lu\.ma/i, label: "RSVP on Luma" },
    { pattern: /mobilize\.us/i, label: "RSVP on Mobilize" },
    { pattern: /actionnetwork\.org/i, label: "Take Action" },
    { pattern: /gofundme\.com/i, label: "Donate on GoFundMe" },
    { pattern: /partiful\.com/i, label: "RSVP on Partiful" }
  ];
  var URL_PATTERN = /https?:\/\/[^\s<>"]+/gi;
  function extractLinks(description, config) {
    if (!description) return { links: [], description };
    const platforms = config && config.knownPlatforms || DEFAULT_PLATFORMS;
    const links = [];
    let cleaned = description;
    const urls = description.match(URL_PATTERN) || [];
    for (const url of urls) {
      for (const platform of platforms) {
        if (platform.pattern.test(url)) {
          const label = platform.labelFn ? platform.labelFn(url) : platform.label;
          links.push({ label, url });
          cleaned = cleaned.replace(url, "").trim();
          break;
        }
      }
    }
    return { links, description: cleaned };
  }

  // node_modules/marked/lib/marked.esm.js
  function _getDefaults() {
    return {
      async: false,
      breaks: false,
      extensions: null,
      gfm: true,
      hooks: null,
      pedantic: false,
      renderer: null,
      silent: false,
      tokenizer: null,
      walkTokens: null
    };
  }
  var _defaults = _getDefaults();
  function changeDefaults(newDefaults) {
    _defaults = newDefaults;
  }
  var noopTest = { exec: () => null };
  function edit(regex, opt = "") {
    let source = typeof regex === "string" ? regex : regex.source;
    const obj = {
      replace: (name, val) => {
        let valSource = typeof val === "string" ? val : val.source;
        valSource = valSource.replace(other.caret, "$1");
        source = source.replace(name, valSource);
        return obj;
      },
      getRegex: () => {
        return new RegExp(source, opt);
      }
    };
    return obj;
  }
  var other = {
    codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
    outputLinkReplace: /\\([\[\]])/g,
    indentCodeCompensation: /^(\s+)(?:```)/,
    beginningSpace: /^\s+/,
    endingHash: /#$/,
    startingSpaceChar: /^ /,
    endingSpaceChar: / $/,
    nonSpaceChar: /[^ ]/,
    newLineCharGlobal: /\n/g,
    tabCharGlobal: /\t/g,
    multipleSpaceGlobal: /\s+/g,
    blankLine: /^[ \t]*$/,
    doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
    blockquoteStart: /^ {0,3}>/,
    blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
    blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
    listReplaceTabs: /^\t+/,
    listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
    listIsTask: /^\[[ xX]\] /,
    listReplaceTask: /^\[[ xX]\] +/,
    anyLine: /\n.*\n/,
    hrefBrackets: /^<(.*)>$/,
    tableDelimiter: /[:|]/,
    tableAlignChars: /^\||\| *$/g,
    tableRowBlankLine: /\n[ \t]*$/,
    tableAlignRight: /^ *-+: *$/,
    tableAlignCenter: /^ *:-+: *$/,
    tableAlignLeft: /^ *:-+ *$/,
    startATag: /^<a /i,
    endATag: /^<\/a>/i,
    startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
    endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
    startAngleBracket: /^</,
    endAngleBracket: />$/,
    pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
    unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
    escapeTest: /[&<>"']/,
    escapeReplace: /[&<>"']/g,
    escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
    escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
    unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,
    caret: /(^|[^\[])\^/g,
    percentDecode: /%25/g,
    findPipe: /\|/g,
    splitPipe: / \|/,
    slashPipe: /\\\|/g,
    carriageReturn: /\r\n|\r/g,
    spaceLine: /^ +$/gm,
    notSpaceStart: /^\S*/,
    endingNewline: /\n$/,
    listItemRegex: (bull) => new RegExp(`^( {0,3}${bull})((?:[	 ][^\\n]*)?(?:\\n|$))`),
    nextBulletRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),
    hrRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),
    fencesBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
    headingBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
    htmlBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, "i")
  };
  var newline = /^(?:[ \t]*(?:\n|$))+/;
  var blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
  var fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
  var hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
  var heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
  var bullet = /(?:[*+-]|\d{1,9}[.)])/;
  var lheadingCore = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
  var lheading = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
  var lheadingGfm = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
  var _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
  var blockText = /^[^\n]+/;
  var _blockLabel = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
  var def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", _blockLabel).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
  var list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
  var _tag = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
  var _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
  var html = edit(
    "^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))",
    "i"
  ).replace("comment", _comment).replace("tag", _tag).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
  var paragraph = edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
  var blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", paragraph).getRegex();
  var blockNormal = {
    blockquote,
    code: blockCode,
    def,
    fences,
    heading,
    hr,
    html,
    lheading,
    list,
    newline,
    paragraph,
    table: noopTest,
    text: blockText
  };
  var gfmTable = edit(
    "^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)"
  ).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
  var blockGfm = {
    ...blockNormal,
    lheading: lheadingGfm,
    table: gfmTable,
    paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", gfmTable).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex()
  };
  var blockPedantic = {
    ...blockNormal,
    html: edit(
      `^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`
    ).replace("comment", _comment).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
    def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
    heading: /^(#{1,6})(.*)(?:\n+|$)/,
    fences: noopTest,
    // fences not supported
    lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
    paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " *#{1,6} *[^\n]").replace("lheading", lheading).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
  };
  var escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
  var inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
  var br = /^( {2,}|\\)\n(?!\s*$)/;
  var inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
  var _punctuation = /[\p{P}\p{S}]/u;
  var _punctuationOrSpace = /[\s\p{P}\p{S}]/u;
  var _notPunctuationOrSpace = /[^\s\p{P}\p{S}]/u;
  var punctuation = edit(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, _punctuationOrSpace).getRegex();
  var _punctuationGfmStrongEm = /(?!~)[\p{P}\p{S}]/u;
  var _punctuationOrSpaceGfmStrongEm = /(?!~)[\s\p{P}\p{S}]/u;
  var _notPunctuationOrSpaceGfmStrongEm = /(?:[^\s\p{P}\p{S}]|~)/u;
  var blockSkip = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
  var emStrongLDelimCore = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
  var emStrongLDelim = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuation).getRegex();
  var emStrongLDelimGfm = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuationGfmStrongEm).getRegex();
  var emStrongRDelimAstCore = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
  var emStrongRDelimAst = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
  var emStrongRDelimAstGfm = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpaceGfmStrongEm).replace(/punctSpace/g, _punctuationOrSpaceGfmStrongEm).replace(/punct/g, _punctuationGfmStrongEm).getRegex();
  var emStrongRDelimUnd = edit(
    "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)",
    "gu"
  ).replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
  var anyPunctuation = edit(/\\(punct)/, "gu").replace(/punct/g, _punctuation).getRegex();
  var autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
  var _inlineComment = edit(_comment).replace("(?:-->|$)", "-->").getRegex();
  var tag = edit(
    "^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>"
  ).replace("comment", _inlineComment).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
  var _inlineLabel = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
  var link = edit(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label", _inlineLabel).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
  var reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace("label", _inlineLabel).replace("ref", _blockLabel).getRegex();
  var nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace("ref", _blockLabel).getRegex();
  var reflinkSearch = edit("reflink|nolink(?!\\()", "g").replace("reflink", reflink).replace("nolink", nolink).getRegex();
  var inlineNormal = {
    _backpedal: noopTest,
    // only used for GFM url
    anyPunctuation,
    autolink,
    blockSkip,
    br,
    code: inlineCode,
    del: noopTest,
    emStrongLDelim,
    emStrongRDelimAst,
    emStrongRDelimUnd,
    escape,
    link,
    nolink,
    punctuation,
    reflink,
    reflinkSearch,
    tag,
    text: inlineText,
    url: noopTest
  };
  var inlinePedantic = {
    ...inlineNormal,
    link: edit(/^!?\[(label)\]\((.*?)\)/).replace("label", _inlineLabel).getRegex(),
    reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", _inlineLabel).getRegex()
  };
  var inlineGfm = {
    ...inlineNormal,
    emStrongRDelimAst: emStrongRDelimAstGfm,
    emStrongLDelim: emStrongLDelimGfm,
    url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
    _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
    del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
    text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
  };
  var inlineBreaks = {
    ...inlineGfm,
    br: edit(br).replace("{2,}", "*").getRegex(),
    text: edit(inlineGfm.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
  };
  var block = {
    normal: blockNormal,
    gfm: blockGfm,
    pedantic: blockPedantic
  };
  var inline = {
    normal: inlineNormal,
    gfm: inlineGfm,
    breaks: inlineBreaks,
    pedantic: inlinePedantic
  };
  var escapeReplacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  var getEscapeReplacement = (ch) => escapeReplacements[ch];
  function escape2(html2, encode) {
    if (encode) {
      if (other.escapeTest.test(html2)) {
        return html2.replace(other.escapeReplace, getEscapeReplacement);
      }
    } else {
      if (other.escapeTestNoEncode.test(html2)) {
        return html2.replace(other.escapeReplaceNoEncode, getEscapeReplacement);
      }
    }
    return html2;
  }
  function cleanUrl(href) {
    try {
      href = encodeURI(href).replace(other.percentDecode, "%");
    } catch {
      return null;
    }
    return href;
  }
  function splitCells(tableRow, count) {
    const row = tableRow.replace(other.findPipe, (match, offset, str) => {
      let escaped = false;
      let curr = offset;
      while (--curr >= 0 && str[curr] === "\\") escaped = !escaped;
      if (escaped) {
        return "|";
      } else {
        return " |";
      }
    }), cells = row.split(other.splitPipe);
    let i = 0;
    if (!cells[0].trim()) {
      cells.shift();
    }
    if (cells.length > 0 && !cells.at(-1)?.trim()) {
      cells.pop();
    }
    if (count) {
      if (cells.length > count) {
        cells.splice(count);
      } else {
        while (cells.length < count) cells.push("");
      }
    }
    for (; i < cells.length; i++) {
      cells[i] = cells[i].trim().replace(other.slashPipe, "|");
    }
    return cells;
  }
  function rtrim(str, c, invert) {
    const l = str.length;
    if (l === 0) {
      return "";
    }
    let suffLen = 0;
    while (suffLen < l) {
      const currChar = str.charAt(l - suffLen - 1);
      if (currChar === c && !invert) {
        suffLen++;
      } else if (currChar !== c && invert) {
        suffLen++;
      } else {
        break;
      }
    }
    return str.slice(0, l - suffLen);
  }
  function findClosingBracket(str, b) {
    if (str.indexOf(b[1]) === -1) {
      return -1;
    }
    let level = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "\\") {
        i++;
      } else if (str[i] === b[0]) {
        level++;
      } else if (str[i] === b[1]) {
        level--;
        if (level < 0) {
          return i;
        }
      }
    }
    if (level > 0) {
      return -2;
    }
    return -1;
  }
  function outputLink(cap, link2, raw, lexer2, rules) {
    const href = link2.href;
    const title = link2.title || null;
    const text = cap[1].replace(rules.other.outputLinkReplace, "$1");
    lexer2.state.inLink = true;
    const token = {
      type: cap[0].charAt(0) === "!" ? "image" : "link",
      raw,
      href,
      title,
      text,
      tokens: lexer2.inlineTokens(text)
    };
    lexer2.state.inLink = false;
    return token;
  }
  function indentCodeCompensation(raw, text, rules) {
    const matchIndentToCode = raw.match(rules.other.indentCodeCompensation);
    if (matchIndentToCode === null) {
      return text;
    }
    const indentToCode = matchIndentToCode[1];
    return text.split("\n").map((node) => {
      const matchIndentInNode = node.match(rules.other.beginningSpace);
      if (matchIndentInNode === null) {
        return node;
      }
      const [indentInNode] = matchIndentInNode;
      if (indentInNode.length >= indentToCode.length) {
        return node.slice(indentToCode.length);
      }
      return node;
    }).join("\n");
  }
  var _Tokenizer = class {
    options;
    rules;
    // set by the lexer
    lexer;
    // set by the lexer
    constructor(options2) {
      this.options = options2 || _defaults;
    }
    space(src) {
      const cap = this.rules.block.newline.exec(src);
      if (cap && cap[0].length > 0) {
        return {
          type: "space",
          raw: cap[0]
        };
      }
    }
    code(src) {
      const cap = this.rules.block.code.exec(src);
      if (cap) {
        const text = cap[0].replace(this.rules.other.codeRemoveIndent, "");
        return {
          type: "code",
          raw: cap[0],
          codeBlockStyle: "indented",
          text: !this.options.pedantic ? rtrim(text, "\n") : text
        };
      }
    }
    fences(src) {
      const cap = this.rules.block.fences.exec(src);
      if (cap) {
        const raw = cap[0];
        const text = indentCodeCompensation(raw, cap[3] || "", this.rules);
        return {
          type: "code",
          raw,
          lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : cap[2],
          text
        };
      }
    }
    heading(src) {
      const cap = this.rules.block.heading.exec(src);
      if (cap) {
        let text = cap[2].trim();
        if (this.rules.other.endingHash.test(text)) {
          const trimmed = rtrim(text, "#");
          if (this.options.pedantic) {
            text = trimmed.trim();
          } else if (!trimmed || this.rules.other.endingSpaceChar.test(trimmed)) {
            text = trimmed.trim();
          }
        }
        return {
          type: "heading",
          raw: cap[0],
          depth: cap[1].length,
          text,
          tokens: this.lexer.inline(text)
        };
      }
    }
    hr(src) {
      const cap = this.rules.block.hr.exec(src);
      if (cap) {
        return {
          type: "hr",
          raw: rtrim(cap[0], "\n")
        };
      }
    }
    blockquote(src) {
      const cap = this.rules.block.blockquote.exec(src);
      if (cap) {
        let lines = rtrim(cap[0], "\n").split("\n");
        let raw = "";
        let text = "";
        const tokens = [];
        while (lines.length > 0) {
          let inBlockquote = false;
          const currentLines = [];
          let i;
          for (i = 0; i < lines.length; i++) {
            if (this.rules.other.blockquoteStart.test(lines[i])) {
              currentLines.push(lines[i]);
              inBlockquote = true;
            } else if (!inBlockquote) {
              currentLines.push(lines[i]);
            } else {
              break;
            }
          }
          lines = lines.slice(i);
          const currentRaw = currentLines.join("\n");
          const currentText = currentRaw.replace(this.rules.other.blockquoteSetextReplace, "\n    $1").replace(this.rules.other.blockquoteSetextReplace2, "");
          raw = raw ? `${raw}
${currentRaw}` : currentRaw;
          text = text ? `${text}
${currentText}` : currentText;
          const top = this.lexer.state.top;
          this.lexer.state.top = true;
          this.lexer.blockTokens(currentText, tokens, true);
          this.lexer.state.top = top;
          if (lines.length === 0) {
            break;
          }
          const lastToken = tokens.at(-1);
          if (lastToken?.type === "code") {
            break;
          } else if (lastToken?.type === "blockquote") {
            const oldToken = lastToken;
            const newText = oldToken.raw + "\n" + lines.join("\n");
            const newToken = this.blockquote(newText);
            tokens[tokens.length - 1] = newToken;
            raw = raw.substring(0, raw.length - oldToken.raw.length) + newToken.raw;
            text = text.substring(0, text.length - oldToken.text.length) + newToken.text;
            break;
          } else if (lastToken?.type === "list") {
            const oldToken = lastToken;
            const newText = oldToken.raw + "\n" + lines.join("\n");
            const newToken = this.list(newText);
            tokens[tokens.length - 1] = newToken;
            raw = raw.substring(0, raw.length - lastToken.raw.length) + newToken.raw;
            text = text.substring(0, text.length - oldToken.raw.length) + newToken.raw;
            lines = newText.substring(tokens.at(-1).raw.length).split("\n");
            continue;
          }
        }
        return {
          type: "blockquote",
          raw,
          tokens,
          text
        };
      }
    }
    list(src) {
      let cap = this.rules.block.list.exec(src);
      if (cap) {
        let bull = cap[1].trim();
        const isordered = bull.length > 1;
        const list2 = {
          type: "list",
          raw: "",
          ordered: isordered,
          start: isordered ? +bull.slice(0, -1) : "",
          loose: false,
          items: []
        };
        bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
        if (this.options.pedantic) {
          bull = isordered ? bull : "[*+-]";
        }
        const itemRegex = this.rules.other.listItemRegex(bull);
        let endsWithBlankLine = false;
        while (src) {
          let endEarly = false;
          let raw = "";
          let itemContents = "";
          if (!(cap = itemRegex.exec(src))) {
            break;
          }
          if (this.rules.block.hr.test(src)) {
            break;
          }
          raw = cap[0];
          src = src.substring(raw.length);
          let line = cap[2].split("\n", 1)[0].replace(this.rules.other.listReplaceTabs, (t) => " ".repeat(3 * t.length));
          let nextLine = src.split("\n", 1)[0];
          let blankLine = !line.trim();
          let indent = 0;
          if (this.options.pedantic) {
            indent = 2;
            itemContents = line.trimStart();
          } else if (blankLine) {
            indent = cap[1].length + 1;
          } else {
            indent = cap[2].search(this.rules.other.nonSpaceChar);
            indent = indent > 4 ? 1 : indent;
            itemContents = line.slice(indent);
            indent += cap[1].length;
          }
          if (blankLine && this.rules.other.blankLine.test(nextLine)) {
            raw += nextLine + "\n";
            src = src.substring(nextLine.length + 1);
            endEarly = true;
          }
          if (!endEarly) {
            const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
            const hrRegex = this.rules.other.hrRegex(indent);
            const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
            const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
            const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
            while (src) {
              const rawLine = src.split("\n", 1)[0];
              let nextLineWithoutTabs;
              nextLine = rawLine;
              if (this.options.pedantic) {
                nextLine = nextLine.replace(this.rules.other.listReplaceNesting, "  ");
                nextLineWithoutTabs = nextLine;
              } else {
                nextLineWithoutTabs = nextLine.replace(this.rules.other.tabCharGlobal, "    ");
              }
              if (fencesBeginRegex.test(nextLine)) {
                break;
              }
              if (headingBeginRegex.test(nextLine)) {
                break;
              }
              if (htmlBeginRegex.test(nextLine)) {
                break;
              }
              if (nextBulletRegex.test(nextLine)) {
                break;
              }
              if (hrRegex.test(nextLine)) {
                break;
              }
              if (nextLineWithoutTabs.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
                itemContents += "\n" + nextLineWithoutTabs.slice(indent);
              } else {
                if (blankLine) {
                  break;
                }
                if (line.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4) {
                  break;
                }
                if (fencesBeginRegex.test(line)) {
                  break;
                }
                if (headingBeginRegex.test(line)) {
                  break;
                }
                if (hrRegex.test(line)) {
                  break;
                }
                itemContents += "\n" + nextLine;
              }
              if (!blankLine && !nextLine.trim()) {
                blankLine = true;
              }
              raw += rawLine + "\n";
              src = src.substring(rawLine.length + 1);
              line = nextLineWithoutTabs.slice(indent);
            }
          }
          if (!list2.loose) {
            if (endsWithBlankLine) {
              list2.loose = true;
            } else if (this.rules.other.doubleBlankLine.test(raw)) {
              endsWithBlankLine = true;
            }
          }
          let istask = null;
          let ischecked;
          if (this.options.gfm) {
            istask = this.rules.other.listIsTask.exec(itemContents);
            if (istask) {
              ischecked = istask[0] !== "[ ] ";
              itemContents = itemContents.replace(this.rules.other.listReplaceTask, "");
            }
          }
          list2.items.push({
            type: "list_item",
            raw,
            task: !!istask,
            checked: ischecked,
            loose: false,
            text: itemContents,
            tokens: []
          });
          list2.raw += raw;
        }
        const lastItem = list2.items.at(-1);
        if (lastItem) {
          lastItem.raw = lastItem.raw.trimEnd();
          lastItem.text = lastItem.text.trimEnd();
        } else {
          return;
        }
        list2.raw = list2.raw.trimEnd();
        for (let i = 0; i < list2.items.length; i++) {
          this.lexer.state.top = false;
          list2.items[i].tokens = this.lexer.blockTokens(list2.items[i].text, []);
          if (!list2.loose) {
            const spacers = list2.items[i].tokens.filter((t) => t.type === "space");
            const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t) => this.rules.other.anyLine.test(t.raw));
            list2.loose = hasMultipleLineBreaks;
          }
        }
        if (list2.loose) {
          for (let i = 0; i < list2.items.length; i++) {
            list2.items[i].loose = true;
          }
        }
        return list2;
      }
    }
    html(src) {
      const cap = this.rules.block.html.exec(src);
      if (cap) {
        const token = {
          type: "html",
          block: true,
          raw: cap[0],
          pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
          text: cap[0]
        };
        return token;
      }
    }
    def(src) {
      const cap = this.rules.block.def.exec(src);
      if (cap) {
        const tag2 = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " ");
        const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "";
        const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : cap[3];
        return {
          type: "def",
          tag: tag2,
          raw: cap[0],
          href,
          title
        };
      }
    }
    table(src) {
      const cap = this.rules.block.table.exec(src);
      if (!cap) {
        return;
      }
      if (!this.rules.other.tableDelimiter.test(cap[2])) {
        return;
      }
      const headers = splitCells(cap[1]);
      const aligns = cap[2].replace(this.rules.other.tableAlignChars, "").split("|");
      const rows = cap[3]?.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, "").split("\n") : [];
      const item = {
        type: "table",
        raw: cap[0],
        header: [],
        align: [],
        rows: []
      };
      if (headers.length !== aligns.length) {
        return;
      }
      for (const align of aligns) {
        if (this.rules.other.tableAlignRight.test(align)) {
          item.align.push("right");
        } else if (this.rules.other.tableAlignCenter.test(align)) {
          item.align.push("center");
        } else if (this.rules.other.tableAlignLeft.test(align)) {
          item.align.push("left");
        } else {
          item.align.push(null);
        }
      }
      for (let i = 0; i < headers.length; i++) {
        item.header.push({
          text: headers[i],
          tokens: this.lexer.inline(headers[i]),
          header: true,
          align: item.align[i]
        });
      }
      for (const row of rows) {
        item.rows.push(splitCells(row, item.header.length).map((cell, i) => {
          return {
            text: cell,
            tokens: this.lexer.inline(cell),
            header: false,
            align: item.align[i]
          };
        }));
      }
      return item;
    }
    lheading(src) {
      const cap = this.rules.block.lheading.exec(src);
      if (cap) {
        return {
          type: "heading",
          raw: cap[0],
          depth: cap[2].charAt(0) === "=" ? 1 : 2,
          text: cap[1],
          tokens: this.lexer.inline(cap[1])
        };
      }
    }
    paragraph(src) {
      const cap = this.rules.block.paragraph.exec(src);
      if (cap) {
        const text = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
        return {
          type: "paragraph",
          raw: cap[0],
          text,
          tokens: this.lexer.inline(text)
        };
      }
    }
    text(src) {
      const cap = this.rules.block.text.exec(src);
      if (cap) {
        return {
          type: "text",
          raw: cap[0],
          text: cap[0],
          tokens: this.lexer.inline(cap[0])
        };
      }
    }
    escape(src) {
      const cap = this.rules.inline.escape.exec(src);
      if (cap) {
        return {
          type: "escape",
          raw: cap[0],
          text: cap[1]
        };
      }
    }
    tag(src) {
      const cap = this.rules.inline.tag.exec(src);
      if (cap) {
        if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
          this.lexer.state.inLink = true;
        } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
          this.lexer.state.inLink = false;
        }
        if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
          this.lexer.state.inRawBlock = true;
        } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
          this.lexer.state.inRawBlock = false;
        }
        return {
          type: "html",
          raw: cap[0],
          inLink: this.lexer.state.inLink,
          inRawBlock: this.lexer.state.inRawBlock,
          block: false,
          text: cap[0]
        };
      }
    }
    link(src) {
      const cap = this.rules.inline.link.exec(src);
      if (cap) {
        const trimmedUrl = cap[2].trim();
        if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
          if (!this.rules.other.endAngleBracket.test(trimmedUrl)) {
            return;
          }
          const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), "\\");
          if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
            return;
          }
        } else {
          const lastParenIndex = findClosingBracket(cap[2], "()");
          if (lastParenIndex === -2) {
            return;
          }
          if (lastParenIndex > -1) {
            const start = cap[0].indexOf("!") === 0 ? 5 : 4;
            const linkLen = start + cap[1].length + lastParenIndex;
            cap[2] = cap[2].substring(0, lastParenIndex);
            cap[0] = cap[0].substring(0, linkLen).trim();
            cap[3] = "";
          }
        }
        let href = cap[2];
        let title = "";
        if (this.options.pedantic) {
          const link2 = this.rules.other.pedanticHrefTitle.exec(href);
          if (link2) {
            href = link2[1];
            title = link2[3];
          }
        } else {
          title = cap[3] ? cap[3].slice(1, -1) : "";
        }
        href = href.trim();
        if (this.rules.other.startAngleBracket.test(href)) {
          if (this.options.pedantic && !this.rules.other.endAngleBracket.test(trimmedUrl)) {
            href = href.slice(1);
          } else {
            href = href.slice(1, -1);
          }
        }
        return outputLink(cap, {
          href: href ? href.replace(this.rules.inline.anyPunctuation, "$1") : href,
          title: title ? title.replace(this.rules.inline.anyPunctuation, "$1") : title
        }, cap[0], this.lexer, this.rules);
      }
    }
    reflink(src, links) {
      let cap;
      if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
        const linkString = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, " ");
        const link2 = links[linkString.toLowerCase()];
        if (!link2) {
          const text = cap[0].charAt(0);
          return {
            type: "text",
            raw: text,
            text
          };
        }
        return outputLink(cap, link2, cap[0], this.lexer, this.rules);
      }
    }
    emStrong(src, maskedSrc, prevChar = "") {
      let match = this.rules.inline.emStrongLDelim.exec(src);
      if (!match) return;
      if (match[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;
      const nextChar = match[1] || match[2] || "";
      if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
        const lLength = [...match[0]].length - 1;
        let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
        const endReg = match[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
        endReg.lastIndex = 0;
        maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
        while ((match = endReg.exec(maskedSrc)) != null) {
          rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
          if (!rDelim) continue;
          rLength = [...rDelim].length;
          if (match[3] || match[4]) {
            delimTotal += rLength;
            continue;
          } else if (match[5] || match[6]) {
            if (lLength % 3 && !((lLength + rLength) % 3)) {
              midDelimTotal += rLength;
              continue;
            }
          }
          delimTotal -= rLength;
          if (delimTotal > 0) continue;
          rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
          const lastCharLength = [...match[0]][0].length;
          const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
          if (Math.min(lLength, rLength) % 2) {
            const text2 = raw.slice(1, -1);
            return {
              type: "em",
              raw,
              text: text2,
              tokens: this.lexer.inlineTokens(text2)
            };
          }
          const text = raw.slice(2, -2);
          return {
            type: "strong",
            raw,
            text,
            tokens: this.lexer.inlineTokens(text)
          };
        }
      }
    }
    codespan(src) {
      const cap = this.rules.inline.code.exec(src);
      if (cap) {
        let text = cap[2].replace(this.rules.other.newLineCharGlobal, " ");
        const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text);
        const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text) && this.rules.other.endingSpaceChar.test(text);
        if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
          text = text.substring(1, text.length - 1);
        }
        return {
          type: "codespan",
          raw: cap[0],
          text
        };
      }
    }
    br(src) {
      const cap = this.rules.inline.br.exec(src);
      if (cap) {
        return {
          type: "br",
          raw: cap[0]
        };
      }
    }
    del(src) {
      const cap = this.rules.inline.del.exec(src);
      if (cap) {
        return {
          type: "del",
          raw: cap[0],
          text: cap[2],
          tokens: this.lexer.inlineTokens(cap[2])
        };
      }
    }
    autolink(src) {
      const cap = this.rules.inline.autolink.exec(src);
      if (cap) {
        let text, href;
        if (cap[2] === "@") {
          text = cap[1];
          href = "mailto:" + text;
        } else {
          text = cap[1];
          href = text;
        }
        return {
          type: "link",
          raw: cap[0],
          text,
          href,
          tokens: [
            {
              type: "text",
              raw: text,
              text
            }
          ]
        };
      }
    }
    url(src) {
      let cap;
      if (cap = this.rules.inline.url.exec(src)) {
        let text, href;
        if (cap[2] === "@") {
          text = cap[0];
          href = "mailto:" + text;
        } else {
          let prevCapZero;
          do {
            prevCapZero = cap[0];
            cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
          } while (prevCapZero !== cap[0]);
          text = cap[0];
          if (cap[1] === "www.") {
            href = "http://" + cap[0];
          } else {
            href = cap[0];
          }
        }
        return {
          type: "link",
          raw: cap[0],
          text,
          href,
          tokens: [
            {
              type: "text",
              raw: text,
              text
            }
          ]
        };
      }
    }
    inlineText(src) {
      const cap = this.rules.inline.text.exec(src);
      if (cap) {
        const escaped = this.lexer.state.inRawBlock;
        return {
          type: "text",
          raw: cap[0],
          text: cap[0],
          escaped
        };
      }
    }
  };
  var _Lexer = class __Lexer {
    tokens;
    options;
    state;
    tokenizer;
    inlineQueue;
    constructor(options2) {
      this.tokens = [];
      this.tokens.links = /* @__PURE__ */ Object.create(null);
      this.options = options2 || _defaults;
      this.options.tokenizer = this.options.tokenizer || new _Tokenizer();
      this.tokenizer = this.options.tokenizer;
      this.tokenizer.options = this.options;
      this.tokenizer.lexer = this;
      this.inlineQueue = [];
      this.state = {
        inLink: false,
        inRawBlock: false,
        top: true
      };
      const rules = {
        other,
        block: block.normal,
        inline: inline.normal
      };
      if (this.options.pedantic) {
        rules.block = block.pedantic;
        rules.inline = inline.pedantic;
      } else if (this.options.gfm) {
        rules.block = block.gfm;
        if (this.options.breaks) {
          rules.inline = inline.breaks;
        } else {
          rules.inline = inline.gfm;
        }
      }
      this.tokenizer.rules = rules;
    }
    /**
     * Expose Rules
     */
    static get rules() {
      return {
        block,
        inline
      };
    }
    /**
     * Static Lex Method
     */
    static lex(src, options2) {
      const lexer2 = new __Lexer(options2);
      return lexer2.lex(src);
    }
    /**
     * Static Lex Inline Method
     */
    static lexInline(src, options2) {
      const lexer2 = new __Lexer(options2);
      return lexer2.inlineTokens(src);
    }
    /**
     * Preprocessing
     */
    lex(src) {
      src = src.replace(other.carriageReturn, "\n");
      this.blockTokens(src, this.tokens);
      for (let i = 0; i < this.inlineQueue.length; i++) {
        const next = this.inlineQueue[i];
        this.inlineTokens(next.src, next.tokens);
      }
      this.inlineQueue = [];
      return this.tokens;
    }
    blockTokens(src, tokens = [], lastParagraphClipped = false) {
      if (this.options.pedantic) {
        src = src.replace(other.tabCharGlobal, "    ").replace(other.spaceLine, "");
      }
      while (src) {
        let token;
        if (this.options.extensions?.block?.some((extTokenizer) => {
          if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            return true;
          }
          return false;
        })) {
          continue;
        }
        if (token = this.tokenizer.space(src)) {
          src = src.substring(token.raw.length);
          const lastToken = tokens.at(-1);
          if (token.raw.length === 1 && lastToken !== void 0) {
            lastToken.raw += "\n";
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (token = this.tokenizer.code(src)) {
          src = src.substring(token.raw.length);
          const lastToken = tokens.at(-1);
          if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.text;
            this.inlineQueue.at(-1).src = lastToken.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (token = this.tokenizer.fences(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.heading(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.hr(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.blockquote(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.list(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.html(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.def(src)) {
          src = src.substring(token.raw.length);
          const lastToken = tokens.at(-1);
          if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.raw;
            this.inlineQueue.at(-1).src = lastToken.text;
          } else if (!this.tokens.links[token.tag]) {
            this.tokens.links[token.tag] = {
              href: token.href,
              title: token.title
            };
          }
          continue;
        }
        if (token = this.tokenizer.table(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.lheading(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        let cutSrc = src;
        if (this.options.extensions?.startBlock) {
          let startIndex = Infinity;
          const tempSrc = src.slice(1);
          let tempStart;
          this.options.extensions.startBlock.forEach((getStartIndex) => {
            tempStart = getStartIndex.call({ lexer: this }, tempSrc);
            if (typeof tempStart === "number" && tempStart >= 0) {
              startIndex = Math.min(startIndex, tempStart);
            }
          });
          if (startIndex < Infinity && startIndex >= 0) {
            cutSrc = src.substring(0, startIndex + 1);
          }
        }
        if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
          const lastToken = tokens.at(-1);
          if (lastParagraphClipped && lastToken?.type === "paragraph") {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.text;
            this.inlineQueue.pop();
            this.inlineQueue.at(-1).src = lastToken.text;
          } else {
            tokens.push(token);
          }
          lastParagraphClipped = cutSrc.length !== src.length;
          src = src.substring(token.raw.length);
          continue;
        }
        if (token = this.tokenizer.text(src)) {
          src = src.substring(token.raw.length);
          const lastToken = tokens.at(-1);
          if (lastToken?.type === "text") {
            lastToken.raw += "\n" + token.raw;
            lastToken.text += "\n" + token.text;
            this.inlineQueue.pop();
            this.inlineQueue.at(-1).src = lastToken.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (src) {
          const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
          if (this.options.silent) {
            console.error(errMsg);
            break;
          } else {
            throw new Error(errMsg);
          }
        }
      }
      this.state.top = true;
      return tokens;
    }
    inline(src, tokens = []) {
      this.inlineQueue.push({ src, tokens });
      return tokens;
    }
    /**
     * Lexing/Compiling
     */
    inlineTokens(src, tokens = []) {
      let maskedSrc = src;
      let match = null;
      if (this.tokens.links) {
        const links = Object.keys(this.tokens.links);
        if (links.length > 0) {
          while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
            if (links.includes(match[0].slice(match[0].lastIndexOf("[") + 1, -1))) {
              maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
            }
          }
        }
      }
      while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
        maskedSrc = maskedSrc.slice(0, match.index) + "++" + maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
      }
      while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
        maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
      }
      let keepPrevChar = false;
      let prevChar = "";
      while (src) {
        if (!keepPrevChar) {
          prevChar = "";
        }
        keepPrevChar = false;
        let token;
        if (this.options.extensions?.inline?.some((extTokenizer) => {
          if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
            src = src.substring(token.raw.length);
            tokens.push(token);
            return true;
          }
          return false;
        })) {
          continue;
        }
        if (token = this.tokenizer.escape(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.tag(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.link(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.reflink(src, this.tokens.links)) {
          src = src.substring(token.raw.length);
          const lastToken = tokens.at(-1);
          if (token.type === "text" && lastToken?.type === "text") {
            lastToken.raw += token.raw;
            lastToken.text += token.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.codespan(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.br(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.del(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (token = this.tokenizer.autolink(src)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        if (!this.state.inLink && (token = this.tokenizer.url(src))) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          continue;
        }
        let cutSrc = src;
        if (this.options.extensions?.startInline) {
          let startIndex = Infinity;
          const tempSrc = src.slice(1);
          let tempStart;
          this.options.extensions.startInline.forEach((getStartIndex) => {
            tempStart = getStartIndex.call({ lexer: this }, tempSrc);
            if (typeof tempStart === "number" && tempStart >= 0) {
              startIndex = Math.min(startIndex, tempStart);
            }
          });
          if (startIndex < Infinity && startIndex >= 0) {
            cutSrc = src.substring(0, startIndex + 1);
          }
        }
        if (token = this.tokenizer.inlineText(cutSrc)) {
          src = src.substring(token.raw.length);
          if (token.raw.slice(-1) !== "_") {
            prevChar = token.raw.slice(-1);
          }
          keepPrevChar = true;
          const lastToken = tokens.at(-1);
          if (lastToken?.type === "text") {
            lastToken.raw += token.raw;
            lastToken.text += token.text;
          } else {
            tokens.push(token);
          }
          continue;
        }
        if (src) {
          const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
          if (this.options.silent) {
            console.error(errMsg);
            break;
          } else {
            throw new Error(errMsg);
          }
        }
      }
      return tokens;
    }
  };
  var _Renderer = class {
    options;
    parser;
    // set by the parser
    constructor(options2) {
      this.options = options2 || _defaults;
    }
    space(token) {
      return "";
    }
    code({ text, lang, escaped }) {
      const langString = (lang || "").match(other.notSpaceStart)?.[0];
      const code = text.replace(other.endingNewline, "") + "\n";
      if (!langString) {
        return "<pre><code>" + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
      }
      return '<pre><code class="language-' + escape2(langString) + '">' + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
    }
    blockquote({ tokens }) {
      const body = this.parser.parse(tokens);
      return `<blockquote>
${body}</blockquote>
`;
    }
    html({ text }) {
      return text;
    }
    heading({ tokens, depth }) {
      return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>
`;
    }
    hr(token) {
      return "<hr>\n";
    }
    list(token) {
      const ordered = token.ordered;
      const start = token.start;
      let body = "";
      for (let j = 0; j < token.items.length; j++) {
        const item = token.items[j];
        body += this.listitem(item);
      }
      const type = ordered ? "ol" : "ul";
      const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : "";
      return "<" + type + startAttr + ">\n" + body + "</" + type + ">\n";
    }
    listitem(item) {
      let itemBody = "";
      if (item.task) {
        const checkbox = this.checkbox({ checked: !!item.checked });
        if (item.loose) {
          if (item.tokens[0]?.type === "paragraph") {
            item.tokens[0].text = checkbox + " " + item.tokens[0].text;
            if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === "text") {
              item.tokens[0].tokens[0].text = checkbox + " " + escape2(item.tokens[0].tokens[0].text);
              item.tokens[0].tokens[0].escaped = true;
            }
          } else {
            item.tokens.unshift({
              type: "text",
              raw: checkbox + " ",
              text: checkbox + " ",
              escaped: true
            });
          }
        } else {
          itemBody += checkbox + " ";
        }
      }
      itemBody += this.parser.parse(item.tokens, !!item.loose);
      return `<li>${itemBody}</li>
`;
    }
    checkbox({ checked }) {
      return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
    }
    paragraph({ tokens }) {
      return `<p>${this.parser.parseInline(tokens)}</p>
`;
    }
    table(token) {
      let header = "";
      let cell = "";
      for (let j = 0; j < token.header.length; j++) {
        cell += this.tablecell(token.header[j]);
      }
      header += this.tablerow({ text: cell });
      let body = "";
      for (let j = 0; j < token.rows.length; j++) {
        const row = token.rows[j];
        cell = "";
        for (let k = 0; k < row.length; k++) {
          cell += this.tablecell(row[k]);
        }
        body += this.tablerow({ text: cell });
      }
      if (body) body = `<tbody>${body}</tbody>`;
      return "<table>\n<thead>\n" + header + "</thead>\n" + body + "</table>\n";
    }
    tablerow({ text }) {
      return `<tr>
${text}</tr>
`;
    }
    tablecell(token) {
      const content = this.parser.parseInline(token.tokens);
      const type = token.header ? "th" : "td";
      const tag2 = token.align ? `<${type} align="${token.align}">` : `<${type}>`;
      return tag2 + content + `</${type}>
`;
    }
    /**
     * span level renderer
     */
    strong({ tokens }) {
      return `<strong>${this.parser.parseInline(tokens)}</strong>`;
    }
    em({ tokens }) {
      return `<em>${this.parser.parseInline(tokens)}</em>`;
    }
    codespan({ text }) {
      return `<code>${escape2(text, true)}</code>`;
    }
    br(token) {
      return "<br>";
    }
    del({ tokens }) {
      return `<del>${this.parser.parseInline(tokens)}</del>`;
    }
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const cleanHref = cleanUrl(href);
      if (cleanHref === null) {
        return text;
      }
      href = cleanHref;
      let out = '<a href="' + href + '"';
      if (title) {
        out += ' title="' + escape2(title) + '"';
      }
      out += ">" + text + "</a>";
      return out;
    }
    image({ href, title, text, tokens }) {
      if (tokens) {
        text = this.parser.parseInline(tokens, this.parser.textRenderer);
      }
      const cleanHref = cleanUrl(href);
      if (cleanHref === null) {
        return escape2(text);
      }
      href = cleanHref;
      let out = `<img src="${href}" alt="${text}"`;
      if (title) {
        out += ` title="${escape2(title)}"`;
      }
      out += ">";
      return out;
    }
    text(token) {
      return "tokens" in token && token.tokens ? this.parser.parseInline(token.tokens) : "escaped" in token && token.escaped ? token.text : escape2(token.text);
    }
  };
  var _TextRenderer = class {
    // no need for block level renderers
    strong({ text }) {
      return text;
    }
    em({ text }) {
      return text;
    }
    codespan({ text }) {
      return text;
    }
    del({ text }) {
      return text;
    }
    html({ text }) {
      return text;
    }
    text({ text }) {
      return text;
    }
    link({ text }) {
      return "" + text;
    }
    image({ text }) {
      return "" + text;
    }
    br() {
      return "";
    }
  };
  var _Parser = class __Parser {
    options;
    renderer;
    textRenderer;
    constructor(options2) {
      this.options = options2 || _defaults;
      this.options.renderer = this.options.renderer || new _Renderer();
      this.renderer = this.options.renderer;
      this.renderer.options = this.options;
      this.renderer.parser = this;
      this.textRenderer = new _TextRenderer();
    }
    /**
     * Static Parse Method
     */
    static parse(tokens, options2) {
      const parser2 = new __Parser(options2);
      return parser2.parse(tokens);
    }
    /**
     * Static Parse Inline Method
     */
    static parseInline(tokens, options2) {
      const parser2 = new __Parser(options2);
      return parser2.parseInline(tokens);
    }
    /**
     * Parse Loop
     */
    parse(tokens, top = true) {
      let out = "";
      for (let i = 0; i < tokens.length; i++) {
        const anyToken = tokens[i];
        if (this.options.extensions?.renderers?.[anyToken.type]) {
          const genericToken = anyToken;
          const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
          if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
            out += ret || "";
            continue;
          }
        }
        const token = anyToken;
        switch (token.type) {
          case "space": {
            out += this.renderer.space(token);
            continue;
          }
          case "hr": {
            out += this.renderer.hr(token);
            continue;
          }
          case "heading": {
            out += this.renderer.heading(token);
            continue;
          }
          case "code": {
            out += this.renderer.code(token);
            continue;
          }
          case "table": {
            out += this.renderer.table(token);
            continue;
          }
          case "blockquote": {
            out += this.renderer.blockquote(token);
            continue;
          }
          case "list": {
            out += this.renderer.list(token);
            continue;
          }
          case "html": {
            out += this.renderer.html(token);
            continue;
          }
          case "paragraph": {
            out += this.renderer.paragraph(token);
            continue;
          }
          case "text": {
            let textToken = token;
            let body = this.renderer.text(textToken);
            while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
              textToken = tokens[++i];
              body += "\n" + this.renderer.text(textToken);
            }
            if (top) {
              out += this.renderer.paragraph({
                type: "paragraph",
                raw: body,
                text: body,
                tokens: [{ type: "text", raw: body, text: body, escaped: true }]
              });
            } else {
              out += body;
            }
            continue;
          }
          default: {
            const errMsg = 'Token with "' + token.type + '" type was not found.';
            if (this.options.silent) {
              console.error(errMsg);
              return "";
            } else {
              throw new Error(errMsg);
            }
          }
        }
      }
      return out;
    }
    /**
     * Parse Inline Tokens
     */
    parseInline(tokens, renderer = this.renderer) {
      let out = "";
      for (let i = 0; i < tokens.length; i++) {
        const anyToken = tokens[i];
        if (this.options.extensions?.renderers?.[anyToken.type]) {
          const ret = this.options.extensions.renderers[anyToken.type].call({ parser: this }, anyToken);
          if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(anyToken.type)) {
            out += ret || "";
            continue;
          }
        }
        const token = anyToken;
        switch (token.type) {
          case "escape": {
            out += renderer.text(token);
            break;
          }
          case "html": {
            out += renderer.html(token);
            break;
          }
          case "link": {
            out += renderer.link(token);
            break;
          }
          case "image": {
            out += renderer.image(token);
            break;
          }
          case "strong": {
            out += renderer.strong(token);
            break;
          }
          case "em": {
            out += renderer.em(token);
            break;
          }
          case "codespan": {
            out += renderer.codespan(token);
            break;
          }
          case "br": {
            out += renderer.br(token);
            break;
          }
          case "del": {
            out += renderer.del(token);
            break;
          }
          case "text": {
            out += renderer.text(token);
            break;
          }
          default: {
            const errMsg = 'Token with "' + token.type + '" type was not found.';
            if (this.options.silent) {
              console.error(errMsg);
              return "";
            } else {
              throw new Error(errMsg);
            }
          }
        }
      }
      return out;
    }
  };
  var _Hooks = class {
    options;
    block;
    constructor(options2) {
      this.options = options2 || _defaults;
    }
    static passThroughHooks = /* @__PURE__ */ new Set([
      "preprocess",
      "postprocess",
      "processAllTokens"
    ]);
    /**
     * Process markdown before marked
     */
    preprocess(markdown) {
      return markdown;
    }
    /**
     * Process HTML after marked is finished
     */
    postprocess(html2) {
      return html2;
    }
    /**
     * Process all tokens before walk tokens
     */
    processAllTokens(tokens) {
      return tokens;
    }
    /**
     * Provide function to tokenize markdown
     */
    provideLexer() {
      return this.block ? _Lexer.lex : _Lexer.lexInline;
    }
    /**
     * Provide function to parse tokens
     */
    provideParser() {
      return this.block ? _Parser.parse : _Parser.parseInline;
    }
  };
  var Marked = class {
    defaults = _getDefaults();
    options = this.setOptions;
    parse = this.parseMarkdown(true);
    parseInline = this.parseMarkdown(false);
    Parser = _Parser;
    Renderer = _Renderer;
    TextRenderer = _TextRenderer;
    Lexer = _Lexer;
    Tokenizer = _Tokenizer;
    Hooks = _Hooks;
    constructor(...args) {
      this.use(...args);
    }
    /**
     * Run callback for every token
     */
    walkTokens(tokens, callback) {
      let values = [];
      for (const token of tokens) {
        values = values.concat(callback.call(this, token));
        switch (token.type) {
          case "table": {
            const tableToken = token;
            for (const cell of tableToken.header) {
              values = values.concat(this.walkTokens(cell.tokens, callback));
            }
            for (const row of tableToken.rows) {
              for (const cell of row) {
                values = values.concat(this.walkTokens(cell.tokens, callback));
              }
            }
            break;
          }
          case "list": {
            const listToken = token;
            values = values.concat(this.walkTokens(listToken.items, callback));
            break;
          }
          default: {
            const genericToken = token;
            if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
              this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
                const tokens2 = genericToken[childTokens].flat(Infinity);
                values = values.concat(this.walkTokens(tokens2, callback));
              });
            } else if (genericToken.tokens) {
              values = values.concat(this.walkTokens(genericToken.tokens, callback));
            }
          }
        }
      }
      return values;
    }
    use(...args) {
      const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
      args.forEach((pack) => {
        const opts = { ...pack };
        opts.async = this.defaults.async || opts.async || false;
        if (pack.extensions) {
          pack.extensions.forEach((ext) => {
            if (!ext.name) {
              throw new Error("extension name required");
            }
            if ("renderer" in ext) {
              const prevRenderer = extensions.renderers[ext.name];
              if (prevRenderer) {
                extensions.renderers[ext.name] = function(...args2) {
                  let ret = ext.renderer.apply(this, args2);
                  if (ret === false) {
                    ret = prevRenderer.apply(this, args2);
                  }
                  return ret;
                };
              } else {
                extensions.renderers[ext.name] = ext.renderer;
              }
            }
            if ("tokenizer" in ext) {
              if (!ext.level || ext.level !== "block" && ext.level !== "inline") {
                throw new Error("extension level must be 'block' or 'inline'");
              }
              const extLevel = extensions[ext.level];
              if (extLevel) {
                extLevel.unshift(ext.tokenizer);
              } else {
                extensions[ext.level] = [ext.tokenizer];
              }
              if (ext.start) {
                if (ext.level === "block") {
                  if (extensions.startBlock) {
                    extensions.startBlock.push(ext.start);
                  } else {
                    extensions.startBlock = [ext.start];
                  }
                } else if (ext.level === "inline") {
                  if (extensions.startInline) {
                    extensions.startInline.push(ext.start);
                  } else {
                    extensions.startInline = [ext.start];
                  }
                }
              }
            }
            if ("childTokens" in ext && ext.childTokens) {
              extensions.childTokens[ext.name] = ext.childTokens;
            }
          });
          opts.extensions = extensions;
        }
        if (pack.renderer) {
          const renderer = this.defaults.renderer || new _Renderer(this.defaults);
          for (const prop in pack.renderer) {
            if (!(prop in renderer)) {
              throw new Error(`renderer '${prop}' does not exist`);
            }
            if (["options", "parser"].includes(prop)) {
              continue;
            }
            const rendererProp = prop;
            const rendererFunc = pack.renderer[rendererProp];
            const prevRenderer = renderer[rendererProp];
            renderer[rendererProp] = (...args2) => {
              let ret = rendererFunc.apply(renderer, args2);
              if (ret === false) {
                ret = prevRenderer.apply(renderer, args2);
              }
              return ret || "";
            };
          }
          opts.renderer = renderer;
        }
        if (pack.tokenizer) {
          const tokenizer = this.defaults.tokenizer || new _Tokenizer(this.defaults);
          for (const prop in pack.tokenizer) {
            if (!(prop in tokenizer)) {
              throw new Error(`tokenizer '${prop}' does not exist`);
            }
            if (["options", "rules", "lexer"].includes(prop)) {
              continue;
            }
            const tokenizerProp = prop;
            const tokenizerFunc = pack.tokenizer[tokenizerProp];
            const prevTokenizer = tokenizer[tokenizerProp];
            tokenizer[tokenizerProp] = (...args2) => {
              let ret = tokenizerFunc.apply(tokenizer, args2);
              if (ret === false) {
                ret = prevTokenizer.apply(tokenizer, args2);
              }
              return ret;
            };
          }
          opts.tokenizer = tokenizer;
        }
        if (pack.hooks) {
          const hooks = this.defaults.hooks || new _Hooks();
          for (const prop in pack.hooks) {
            if (!(prop in hooks)) {
              throw new Error(`hook '${prop}' does not exist`);
            }
            if (["options", "block"].includes(prop)) {
              continue;
            }
            const hooksProp = prop;
            const hooksFunc = pack.hooks[hooksProp];
            const prevHook = hooks[hooksProp];
            if (_Hooks.passThroughHooks.has(prop)) {
              hooks[hooksProp] = (arg) => {
                if (this.defaults.async) {
                  return Promise.resolve(hooksFunc.call(hooks, arg)).then((ret2) => {
                    return prevHook.call(hooks, ret2);
                  });
                }
                const ret = hooksFunc.call(hooks, arg);
                return prevHook.call(hooks, ret);
              };
            } else {
              hooks[hooksProp] = (...args2) => {
                let ret = hooksFunc.apply(hooks, args2);
                if (ret === false) {
                  ret = prevHook.apply(hooks, args2);
                }
                return ret;
              };
            }
          }
          opts.hooks = hooks;
        }
        if (pack.walkTokens) {
          const walkTokens2 = this.defaults.walkTokens;
          const packWalktokens = pack.walkTokens;
          opts.walkTokens = function(token) {
            let values = [];
            values.push(packWalktokens.call(this, token));
            if (walkTokens2) {
              values = values.concat(walkTokens2.call(this, token));
            }
            return values;
          };
        }
        this.defaults = { ...this.defaults, ...opts };
      });
      return this;
    }
    setOptions(opt) {
      this.defaults = { ...this.defaults, ...opt };
      return this;
    }
    lexer(src, options2) {
      return _Lexer.lex(src, options2 ?? this.defaults);
    }
    parser(tokens, options2) {
      return _Parser.parse(tokens, options2 ?? this.defaults);
    }
    parseMarkdown(blockType) {
      const parse2 = (src, options2) => {
        const origOpt = { ...options2 };
        const opt = { ...this.defaults, ...origOpt };
        const throwError = this.onError(!!opt.silent, !!opt.async);
        if (this.defaults.async === true && origOpt.async === false) {
          return throwError(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
        }
        if (typeof src === "undefined" || src === null) {
          return throwError(new Error("marked(): input parameter is undefined or null"));
        }
        if (typeof src !== "string") {
          return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
        }
        if (opt.hooks) {
          opt.hooks.options = opt;
          opt.hooks.block = blockType;
        }
        const lexer2 = opt.hooks ? opt.hooks.provideLexer() : blockType ? _Lexer.lex : _Lexer.lexInline;
        const parser2 = opt.hooks ? opt.hooks.provideParser() : blockType ? _Parser.parse : _Parser.parseInline;
        if (opt.async) {
          return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src).then((src2) => lexer2(src2, opt)).then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens).then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens).then((tokens) => parser2(tokens, opt)).then((html2) => opt.hooks ? opt.hooks.postprocess(html2) : html2).catch(throwError);
        }
        try {
          if (opt.hooks) {
            src = opt.hooks.preprocess(src);
          }
          let tokens = lexer2(src, opt);
          if (opt.hooks) {
            tokens = opt.hooks.processAllTokens(tokens);
          }
          if (opt.walkTokens) {
            this.walkTokens(tokens, opt.walkTokens);
          }
          let html2 = parser2(tokens, opt);
          if (opt.hooks) {
            html2 = opt.hooks.postprocess(html2);
          }
          return html2;
        } catch (e) {
          return throwError(e);
        }
      };
      return parse2;
    }
    onError(silent, async) {
      return (e) => {
        e.message += "\nPlease report this to https://github.com/markedjs/marked.";
        if (silent) {
          const msg = "<p>An error occurred:</p><pre>" + escape2(e.message + "", true) + "</pre>";
          if (async) {
            return Promise.resolve(msg);
          }
          return msg;
        }
        if (async) {
          return Promise.reject(e);
        }
        throw e;
      };
    }
  };
  var markedInstance = new Marked();
  function marked(src, opt) {
    return markedInstance.parse(src, opt);
  }
  marked.options = marked.setOptions = function(options2) {
    markedInstance.setOptions(options2);
    marked.defaults = markedInstance.defaults;
    changeDefaults(marked.defaults);
    return marked;
  };
  marked.getDefaults = _getDefaults;
  marked.defaults = _defaults;
  marked.use = function(...args) {
    markedInstance.use(...args);
    marked.defaults = markedInstance.defaults;
    changeDefaults(marked.defaults);
    return marked;
  };
  marked.walkTokens = function(tokens, callback) {
    return markedInstance.walkTokens(tokens, callback);
  };
  marked.parseInline = markedInstance.parseInline;
  marked.Parser = _Parser;
  marked.parser = _Parser.parse;
  marked.Renderer = _Renderer;
  marked.TextRenderer = _TextRenderer;
  marked.Lexer = _Lexer;
  marked.lexer = _Lexer.lex;
  marked.Tokenizer = _Tokenizer;
  marked.Hooks = _Hooks;
  marked.parse = marked;
  var options = marked.options;
  var setOptions = marked.setOptions;
  var use = marked.use;
  var walkTokens = marked.walkTokens;
  var parseInline = marked.parseInline;
  var parser = _Parser.parse;
  var lexer = _Lexer.lex;

  // src/util/sanitize.js
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }

  // src/util/description.js
  var DEFAULT_ALLOWED_TAGS = [
    "p",
    "a",
    "strong",
    "em",
    "ul",
    "ol",
    "li",
    "br",
    "img",
    "blockquote",
    "code",
    "pre",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6"
  ];
  var DEFAULT_ALLOWED_ATTRS = {
    a: ["href", "target"],
    img: ["src", "alt"]
  };
  var HTML_TAG_RE = /<\/?[a-z][a-z0-9]*[\s>]/i;
  var MARKDOWN_RE = /(?:^|\n)#{1,6}\s|(?:^|\n)[-*]\s|\*\*|__|\[.+?\]\(.+?\)/;
  function detectFormat(text) {
    if (!text) return "plain";
    if (HTML_TAG_RE.test(text)) return "html";
    if (MARKDOWN_RE.test(text)) return "markdown";
    return "plain";
  }
  function sanitizeHtml(html2, config) {
    const sanitization = config && config.sanitization;
    const allowedTags = new Set(
      sanitization && sanitization.allowedTags || DEFAULT_ALLOWED_TAGS
    );
    const allowedAttrs = sanitization && sanitization.allowedAttrs || DEFAULT_ALLOWED_ATTRS;
    const div = document.createElement("div");
    div.innerHTML = html2;
    sanitizeNode(div, allowedTags, allowedAttrs);
    return div.innerHTML;
  }
  function sanitizeNode(node, allowedTags, allowedAttrs) {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag2 = child.tagName.toLowerCase();
        if (!allowedTags.has(tag2)) {
          while (child.firstChild) {
            node.insertBefore(child.firstChild, child);
          }
          node.removeChild(child);
        } else {
          const allowed = allowedAttrs[tag2] || [];
          const attrs = Array.from(child.attributes);
          for (const attr of attrs) {
            if (!allowed.includes(attr.name)) {
              child.removeAttribute(attr.name);
            }
          }
          sanitizeNode(child, allowedTags, allowedAttrs);
        }
      }
    }
  }
  function renderDescription(text, config) {
    if (!text) return "";
    const format = detectFormat(text);
    switch (format) {
      case "html":
        return sanitizeHtml(text, config);
      case "markdown":
        return sanitizeHtml(marked.parse(text), config);
      case "plain":
      default:
        return escapeHtml(text).replace(/\n/g, "<br>");
    }
  }

  // src/data.js
  async function loadData(config) {
    let data;
    if (config.data) {
      data = config.data;
    } else if (config.fetchUrl) {
      const res = await fetch(config.fetchUrl);
      if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
      data = await res.json();
    } else if (config.google) {
      data = await fetchGoogleCalendar(config.google, config);
    } else {
      throw new Error("og-cal: No data source configured. Provide data, fetchUrl, or google config.");
    }
    if (data.events) {
      data = { ...data, events: data.events.map((event) => enrichEvent(event, config)) };
    }
    if (config.eventTransform && data.events) {
      data = { ...data, events: data.events.map(config.eventTransform) };
    }
    if (config.eventFilter && data.events) {
      data = { ...data, events: data.events.filter(config.eventFilter) };
    }
    return data;
  }
  function enrichEvent(event, config) {
    let description = event.description || "";
    let image = event.image || null;
    let images = event.images && event.images.length > 0 ? event.images : [];
    let links = event.links && event.links.length > 0 ? event.links : [];
    if (images.length === 0 && description) {
      const result = extractImage(description, config);
      image = result.image;
      images = result.images;
      description = result.description;
    }
    const attachmentImages = getImagesFromAttachments(event.attachments);
    if (attachmentImages.length > 0) {
      const existing = new Set(images);
      for (const ai of attachmentImages) {
        if (!existing.has(ai)) {
          images.push(ai);
        }
      }
    }
    if (!image && images.length > 0) image = images[0];
    if (links.length === 0 && description) {
      const result = extractLinks(description, config);
      links = result.links;
      description = result.description;
    }
    const descriptionFormat = event.descriptionFormat || detectFormat(description);
    return { ...event, description, descriptionFormat, image, images, links };
  }
  async function fetchGoogleCalendar({ apiKey, calendarId, maxResults = 50 }, config) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${now}&singleEvents=true&orderBy=startTime&maxResults=${maxResults}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Calendar API error: ${res.status}`);
    const data = await res.json();
    return transformGoogleEvents(data, config);
  }
  function getImagesFromAttachments(attachments) {
    if (!attachments) return [];
    return attachments.filter((a) => a.mimeType && a.mimeType.startsWith("image/")).map((a) => a.fileUrl || a.url).filter(Boolean);
  }
  function transformGoogleEvents(googleData, config) {
    const events = (googleData.items || []).map((item) => {
      let description = item.description || "";
      const { image, images, description: descAfterImage } = extractImage(description, config);
      const { links, description: descAfterLinks } = extractLinks(descAfterImage, config);
      const attachmentImages = getImagesFromAttachments(
        (item.attachments || []).map((a) => ({ ...a, url: a.fileUrl }))
      );
      const allImages = [...images];
      const existing = new Set(allImages);
      for (const ai of attachmentImages) {
        if (!existing.has(ai)) allImages.push(ai);
      }
      return {
        id: item.id,
        title: item.summary || "Untitled Event",
        description: descAfterLinks,
        descriptionFormat: detectFormat(descAfterLinks),
        location: item.location || "",
        start: item.start?.dateTime || item.start?.date || "",
        end: item.end?.dateTime || item.end?.date || "",
        allDay: !item.start?.dateTime,
        image: image || allImages[0] || null,
        images: allImages,
        links,
        attachments: (item.attachments || []).map((a) => ({
          title: a.title,
          url: a.fileUrl,
          mimeType: a.mimeType
        }))
      };
    });
    return {
      events,
      calendar: {
        name: googleData.summary || "",
        timezone: googleData.timeZone || "UTC"
      },
      generated: (/* @__PURE__ */ new Date()).toISOString()
    };
  }

  // src/router.js
  var VALID_VIEWS = ["month", "week", "day", "grid", "list"];
  function storageKey(config) {
    const prefix = config && config.storageKeyPrefix || "ogcal";
    return `${prefix}-view`;
  }
  function parseHash() {
    const hash = window.location.hash.slice(1);
    if (!hash) return null;
    if (hash.startsWith("event/")) {
      return { view: "detail", eventId: hash.slice(6) };
    }
    if (hash.startsWith("day/")) {
      return { view: "day", date: hash.slice(4) };
    }
    if (VALID_VIEWS.includes(hash)) {
      return { view: hash };
    }
    return null;
  }
  function getInitialView(defaultView, enabledViews, config) {
    const fromHash = parseHash();
    if (fromHash) return fromHash;
    const key = storageKey(config);
    const saved = localStorage.getItem(key);
    if (saved && enabledViews.includes(saved)) {
      return { view: saved };
    }
    return { view: defaultView || "month" };
  }
  function setView(view, config) {
    window.location.hash = view;
    const key = storageKey(config);
    localStorage.setItem(key, view);
  }
  function setEventDetail(eventId) {
    window.location.hash = `event/${eventId}`;
  }
  function onHashChange(callback) {
    window.addEventListener("hashchange", () => {
      const parsed = parseHash();
      if (parsed) callback(parsed);
    });
  }

  // src/ui/view-selector.js
  var DEFAULT_VIEW_LABELS = {
    month: "Month",
    week: "Week",
    day: "Day",
    grid: "Grid",
    list: "List"
  };
  function renderViewSelector(container, views, activeView, isMobile, config) {
    const i18n = config && config.i18n || {};
    const viewLabels = { ...DEFAULT_VIEW_LABELS, ...i18n.viewLabels };
    const mobileHiddenViews = config && config.mobileHiddenViews || ["week"];
    const filtered = isMobile ? views.filter((v) => !mobileHiddenViews.includes(v)) : views;
    const bar = document.createElement("div");
    bar.className = "ogcal-view-selector";
    bar.setAttribute("role", "tablist");
    for (const view of filtered) {
      const tab = document.createElement("button");
      tab.className = "ogcal-view-tab" + (view === activeView ? " ogcal-view-tab--active" : "");
      tab.textContent = viewLabels[view] || view;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", view === activeView ? "true" : "false");
      tab.addEventListener("click", () => setView(view, config));
      bar.appendChild(tab);
    }
    container.innerHTML = "";
    container.appendChild(bar);
  }

  // src/ui/states.js
  function renderLoading(container, config) {
    if (config && config.renderLoading) {
      const result = config.renderLoading();
      if (typeof result === "string") {
        container.innerHTML = result;
      } else if (result instanceof HTMLElement || result instanceof DocumentFragment) {
        container.innerHTML = "";
        container.appendChild(result);
      }
      return;
    }
    container.innerHTML = `
    <div class="ogcal-loading">
      <div class="ogcal-loading-pulse"></div>
      <div class="ogcal-loading-pulse"></div>
      <div class="ogcal-loading-pulse"></div>
    </div>`;
  }
  function renderEmpty(container, hasPastEvents, onShowPast, config) {
    const i18n = config && config.i18n || {};
    const noUpcomingEvents = i18n.noUpcomingEvents || "No upcoming events.";
    const showPastEvents = i18n.showPastEvents || "Show past events";
    if (config && config.renderEmpty) {
      const result = config.renderEmpty({ hasPastEvents });
      if (typeof result === "string") {
        container.innerHTML = result;
      } else if (result instanceof HTMLElement || result instanceof DocumentFragment) {
        container.innerHTML = "";
        container.appendChild(result);
      }
      return;
    }
    const pastLink = hasPastEvents ? `<button class="ogcal-empty-past-link" onclick="this.dispatchEvent(new CustomEvent('ogcal:show-past', { bubbles: true }))">${showPastEvents}</button>` : "";
    container.innerHTML = `
    <div class="ogcal-empty">
      <div class="ogcal-empty-icon">\u{1F4C5}</div>
      <p>${noUpcomingEvents}</p>
      ${pastLink}
    </div>`;
    if (hasPastEvents) {
      container.querySelector(".ogcal-empty-past-link")?.addEventListener("click", onShowPast);
    }
  }
  function renderError(container, message, onRetry, config) {
    const i18n = config && config.i18n || {};
    const couldNotLoad = i18n.couldNotLoad || "Could not load events.";
    const retry = i18n.retry || "Retry";
    if (config && config.renderError) {
      const result = config.renderError({ message });
      if (typeof result === "string") {
        container.innerHTML = result;
      } else if (result instanceof HTMLElement || result instanceof DocumentFragment) {
        container.innerHTML = "";
        container.appendChild(result);
      }
      return;
    }
    container.innerHTML = `
    <div class="ogcal-error">
      <p>${couldNotLoad}</p>
      <button class="ogcal-error-retry">${retry}</button>
    </div>`;
    container.querySelector(".ogcal-error-retry")?.addEventListener("click", onRetry);
  }

  // src/ui/past-toggle.js
  function renderPastToggle(container, showingPast, onToggle, config) {
    const i18n = config && config.i18n || {};
    const showLabel = i18n.showPastEvents || "Show past events";
    const hideLabel = i18n.hidePastEvents || "Hide past events";
    const btn = document.createElement("button");
    btn.className = "ogcal-past-toggle";
    btn.textContent = showingPast ? hideLabel : showLabel;
    btn.addEventListener("click", onToggle);
    container.innerHTML = "";
    container.appendChild(btn);
  }

  // src/util/dates.js
  function formatDate(isoString, timezone, locale) {
    locale = locale || "en-US";
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(new Date(isoString));
  }
  function formatDateShort(isoString, timezone, locale) {
    locale = locale || "en-US";
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      month: "short",
      day: "numeric"
    }).format(new Date(isoString));
  }
  function formatTime(isoString, timezone, locale) {
    locale = locale || "en-US";
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(isoString));
  }
  function formatDatetime(isoString, timezone, locale) {
    return `${formatDate(isoString, timezone, locale)} \xB7 ${formatTime(isoString, timezone, locale)}`;
  }
  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }
  function getFirstDayOfMonth(year, month, weekStartDay) {
    weekStartDay = weekStartDay || 0;
    const raw = new Date(year, month, 1).getDay();
    return (raw - weekStartDay + 7) % 7;
  }
  function isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  }
  function isToday(date) {
    return isSameDay(date, /* @__PURE__ */ new Date());
  }
  function isPast(isoString) {
    return new Date(isoString) < /* @__PURE__ */ new Date();
  }
  function getMonthName(year, month, locale) {
    locale = locale || "en-US";
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(year, month));
  }
  function getDatePartsInTz(isoString, timezone, locale) {
    locale = locale || "en-US";
    const d = new Date(isoString);
    const fmt = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric"
    });
    const parts = {};
    for (const { type, value } of fmt.formatToParts(d)) {
      if (type === "year") parts.year = parseInt(value);
      if (type === "month") parts.month = parseInt(value) - 1;
      if (type === "day") parts.day = parseInt(value);
    }
    return parts;
  }
  function getWeekDates(date, weekStartDay) {
    weekStartDay = weekStartDay || 0;
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day - weekStartDay + 7) % 7;
    const start = new Date(d);
    start.setDate(d.getDate() - diff);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      dates.push(current);
    }
    return dates;
  }
  function getDayNames(locale, weekStartDay) {
    locale = locale || "en-US";
    weekStartDay = weekStartDay || 0;
    const names = [];
    const base = new Date(2026, 0, 4);
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + (weekStartDay + i) % 7);
      names.push(new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d));
    }
    return names;
  }

  // src/views/month.js
  function renderMonthView(container, events, timezone, currentDate, config) {
    config = config || {};
    const locale = config.locale;
    const weekStartDay = config.weekStartDay || 0;
    const maxEventsPerDay = config.maxEventsPerDay || 3;
    const i18n = config.i18n || {};
    const moreEventsTemplate = i18n.moreEvents || "+{count} more";
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month, weekStartDay);
    const monthName = getMonthName(year, month, locale);
    const dayNames = getDayNames(locale, weekStartDay);
    const eventsByDate = {};
    for (const event of events) {
      const parts = getDatePartsInTz(event.start, timezone, locale);
      const key = `${parts.year}-${parts.month}-${parts.day}`;
      if (!eventsByDate[key]) eventsByDate[key] = [];
      eventsByDate[key].push(event);
    }
    const grid = document.createElement("div");
    grid.className = "ogcal-month";
    const nav = document.createElement("div");
    nav.className = "ogcal-month-nav";
    nav.innerHTML = `
    <button class="ogcal-month-prev" aria-label="Previous month">\u2039</button>
    <span class="ogcal-month-title">${monthName}</span>
    <button class="ogcal-month-next" aria-label="Next month">\u203A</button>
  `;
    nav.querySelector(".ogcal-month-prev").addEventListener("click", () => {
      const prev = new Date(year, month - 1, 1);
      renderMonthView(container, events, timezone, prev, config);
    });
    nav.querySelector(".ogcal-month-next").addEventListener("click", () => {
      const next = new Date(year, month + 1, 1);
      renderMonthView(container, events, timezone, next, config);
    });
    grid.appendChild(nav);
    const headerRow = document.createElement("div");
    headerRow.className = "ogcal-month-header";
    headerRow.setAttribute("role", "row");
    for (const name of dayNames) {
      const cell = document.createElement("div");
      cell.className = "ogcal-month-dayname";
      cell.textContent = name;
      headerRow.appendChild(cell);
    }
    grid.appendChild(headerRow);
    const body = document.createElement("div");
    body.className = "ogcal-month-body";
    body.setAttribute("role", "grid");
    let row = document.createElement("div");
    row.className = "ogcal-month-row";
    row.setAttribute("role", "row");
    for (let i = 0; i < firstDay; i++) {
      const cell = document.createElement("div");
      cell.className = "ogcal-month-cell ogcal-month-cell--empty";
      cell.setAttribute("role", "gridcell");
      row.appendChild(cell);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(year, month, day);
      const key = `${year}-${month}-${day}`;
      const dayEvents = eventsByDate[key] || [];
      const today = isToday(cellDate);
      const cell = document.createElement("div");
      cell.className = "ogcal-month-cell" + (today ? " ogcal-month-cell--today" : "") + (dayEvents.length ? " ogcal-month-cell--has-events" : "");
      cell.setAttribute("role", "gridcell");
      const dayNum = document.createElement("div");
      dayNum.className = "ogcal-month-day";
      dayNum.textContent = day;
      cell.appendChild(dayNum);
      for (const event of dayEvents.slice(0, maxEventsPerDay)) {
        const chip = document.createElement("div");
        chip.className = "ogcal-month-chip";
        chip.textContent = event.title;
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          if (config.onEventClick) {
            const result = config.onEventClick(event, "month");
            if (result === false) return;
          }
          setEventDetail(event.id);
        });
        cell.appendChild(chip);
      }
      if (dayEvents.length > maxEventsPerDay) {
        const more = document.createElement("div");
        more.className = "ogcal-month-more";
        more.textContent = moreEventsTemplate.replace("{count}", dayEvents.length - maxEventsPerDay);
        cell.appendChild(more);
      }
      row.appendChild(cell);
      if ((firstDay + day) % 7 === 0) {
        body.appendChild(row);
        row = document.createElement("div");
        row.className = "ogcal-month-row";
        row.setAttribute("role", "row");
      }
    }
    const remaining = (firstDay + daysInMonth) % 7;
    if (remaining > 0) {
      for (let i = remaining; i < 7; i++) {
        const cell = document.createElement("div");
        cell.className = "ogcal-month-cell ogcal-month-cell--empty";
        cell.setAttribute("role", "gridcell");
        row.appendChild(cell);
      }
      body.appendChild(row);
    }
    grid.appendChild(body);
    container.innerHTML = "";
    container.appendChild(grid);
  }

  // src/views/week.js
  function renderWeekView(container, events, timezone, currentDate, config) {
    config = config || {};
    const locale = config.locale;
    const weekStartDay = config.weekStartDay || 0;
    const dates = getWeekDates(currentDate, weekStartDay);
    const week = document.createElement("div");
    week.className = "ogcal-week";
    const nav = document.createElement("div");
    nav.className = "ogcal-week-nav";
    const startLabel = formatDateShort(dates[0].toISOString(), timezone, locale);
    const endLabel = formatDateShort(dates[6].toISOString(), timezone, locale);
    nav.innerHTML = `
    <button class="ogcal-week-prev" aria-label="Previous week">\u2039</button>
    <span class="ogcal-week-title">${startLabel} \u2013 ${endLabel}</span>
    <button class="ogcal-week-next" aria-label="Next week">\u203A</button>
  `;
    nav.querySelector(".ogcal-week-prev").addEventListener("click", () => {
      const prev = new Date(currentDate);
      prev.setDate(prev.getDate() - 7);
      renderWeekView(container, events, timezone, prev, config);
    });
    nav.querySelector(".ogcal-week-next").addEventListener("click", () => {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 7);
      renderWeekView(container, events, timezone, next, config);
    });
    week.appendChild(nav);
    const columns = document.createElement("div");
    columns.className = "ogcal-week-columns";
    for (const date of dates) {
      const col = document.createElement("div");
      col.className = "ogcal-week-col" + (isToday(date) ? " ogcal-week-col--today" : "");
      const header = document.createElement("div");
      header.className = "ogcal-week-col-header";
      const dayName = new Intl.DateTimeFormat(locale || "en-US", { weekday: "short" }).format(date);
      header.innerHTML = `<span class="ogcal-week-dayname">${dayName}</span><span class="ogcal-week-daynum">${date.getDate()}</span>`;
      col.appendChild(header);
      const dayEvents = events.filter((e) => {
        const parts = getDatePartsInTz(e.start, timezone, locale);
        return parts.year === date.getFullYear() && parts.month === date.getMonth() && parts.day === date.getDate();
      });
      for (const event of dayEvents) {
        const block2 = document.createElement("div");
        block2.className = "ogcal-week-event";
        block2.textContent = event.title;
        block2.addEventListener("click", () => {
          if (config.onEventClick) {
            const result = config.onEventClick(event, "week");
            if (result === false) return;
          }
          setEventDetail(event.id);
        });
        block2.setAttribute("tabindex", "0");
        col.appendChild(block2);
      }
      columns.appendChild(col);
    }
    week.appendChild(columns);
    container.innerHTML = "";
    container.appendChild(week);
  }

  // src/views/day.js
  function renderDayView(container, events, timezone, currentDate, config) {
    config = config || {};
    const locale = config.locale;
    const i18n = config.i18n || {};
    const allDayLabel = i18n.allDay || "All Day";
    const noEventsLabel = i18n.noEventsThisDay || "No events this day.";
    const day = document.createElement("div");
    day.className = "ogcal-day";
    const nav = document.createElement("div");
    nav.className = "ogcal-day-nav";
    nav.innerHTML = `
    <button class="ogcal-day-prev" aria-label="Previous day">\u2039</button>
    <span class="ogcal-day-title">${formatDate(currentDate.toISOString(), timezone, locale)}</span>
    <button class="ogcal-day-next" aria-label="Next day">\u203A</button>
  `;
    nav.querySelector(".ogcal-day-prev").addEventListener("click", () => {
      const prev = new Date(currentDate);
      prev.setDate(prev.getDate() - 1);
      renderDayView(container, events, timezone, prev, config);
    });
    nav.querySelector(".ogcal-day-next").addEventListener("click", () => {
      const next = new Date(currentDate);
      next.setDate(next.getDate() + 1);
      renderDayView(container, events, timezone, next, config);
    });
    day.appendChild(nav);
    const dayEvents = events.filter((e) => isSameDay(new Date(e.start), currentDate));
    if (dayEvents.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ogcal-day-empty";
      empty.textContent = noEventsLabel;
      day.appendChild(empty);
    } else {
      for (const event of dayEvents) {
        const item = document.createElement("div");
        item.className = "ogcal-day-event";
        item.addEventListener("click", () => {
          if (config.onEventClick) {
            const result = config.onEventClick(event, "day");
            if (result === false) return;
          }
          setEventDetail(event.id);
        });
        item.setAttribute("tabindex", "0");
        const timeStr = event.allDay ? allDayLabel : formatTime(event.start, timezone, locale);
        item.innerHTML = `
        <div class="ogcal-day-event-time">${timeStr}</div>
        <div class="ogcal-day-event-info">
          <div class="ogcal-day-event-title">${escapeHtml(event.title)}</div>
          ${event.location ? `<div class="ogcal-day-event-location">${escapeHtml(event.location)}</div>` : ""}
        </div>
      `;
        day.appendChild(item);
      }
    }
    container.innerHTML = "";
    container.appendChild(day);
  }

  // src/views/grid.js
  function renderGridView(container, events, timezone, config) {
    config = config || {};
    const locale = config.locale;
    const i18n = config.i18n || {};
    const allDayLabel = i18n.allDay || "All Day";
    const grid = document.createElement("div");
    grid.className = "ogcal-grid";
    for (const event of events) {
      const card = document.createElement("div");
      card.className = "ogcal-grid-card" + (isPast(event.start) ? " ogcal-grid-card--past" : "");
      card.addEventListener("click", () => {
        if (config.onEventClick) {
          const result = config.onEventClick(event, "grid");
          if (result === false) return;
        }
        setEventDetail(event.id);
      });
      card.setAttribute("tabindex", "0");
      card.setAttribute("role", "button");
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (config.onEventClick) {
            const result = config.onEventClick(event, "grid");
            if (result === false) return;
          }
          setEventDetail(event.id);
        }
      });
      const dateStr = formatDateShort(event.start, timezone, locale);
      const timeStr = event.allDay ? "" : ` \xB7 ${formatTime(event.start, timezone, locale)}`;
      const imageHtml = event.image ? `<div class="ogcal-grid-image"><img src="${event.image}" alt="${escapeHtml(event.title)}" loading="lazy"></div>` : `<div class="ogcal-grid-image ogcal-grid-image--placeholder"></div>`;
      card.innerHTML = `
      ${imageHtml}
      <div class="ogcal-grid-body">
        <div class="ogcal-grid-title">${escapeHtml(event.title)}</div>
        <div class="ogcal-grid-meta">${dateStr}${timeStr}</div>
        ${event.location ? `<div class="ogcal-grid-location">${escapeHtml(event.location)}</div>` : ""}
      </div>
    `;
      grid.appendChild(card);
    }
    container.innerHTML = "";
    container.appendChild(grid);
  }

  // src/views/list.js
  function renderListView(container, events, timezone, config) {
    config = config || {};
    const locale = config.locale;
    const i18n = config.i18n || {};
    const allDayLabel = i18n.allDay || "All Day";
    const list2 = document.createElement("div");
    list2.className = "ogcal-list";
    for (const event of events) {
      const item = document.createElement("div");
      item.className = "ogcal-list-item" + (isPast(event.start) ? " ogcal-list-item--past" : "");
      item.addEventListener("click", () => {
        if (config.onEventClick) {
          const result = config.onEventClick(event, "list");
          if (result === false) return;
        }
        setEventDetail(event.id);
      });
      item.setAttribute("tabindex", "0");
      item.setAttribute("role", "button");
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (config.onEventClick) {
            const result = config.onEventClick(event, "list");
            if (result === false) return;
          }
          setEventDetail(event.id);
        }
      });
      const dateStr = formatDate(event.start, timezone, locale);
      const timeStr = event.allDay ? allDayLabel : formatTime(event.start, timezone, locale);
      item.innerHTML = `
      <div class="ogcal-list-date">
        <div class="ogcal-list-date-day">${dateStr}</div>
        <div class="ogcal-list-date-time">${timeStr}</div>
      </div>
      <div class="ogcal-list-info">
        <div class="ogcal-list-title">${escapeHtml(event.title)}</div>
        ${event.location ? `<div class="ogcal-list-location">${escapeHtml(event.location)}</div>` : ""}
      </div>
    `;
      list2.appendChild(item);
    }
    container.innerHTML = "";
    container.appendChild(list2);
  }

  // src/views/detail.js
  function renderGallery(images, altText) {
    const gallery = document.createElement("div");
    gallery.className = "ogcal-detail-gallery";
    const imgEl = document.createElement("img");
    imgEl.className = "ogcal-detail-gallery-img";
    imgEl.src = images[0];
    imgEl.alt = altText;
    imgEl.loading = "lazy";
    gallery.appendChild(imgEl);
    if (images.length <= 1) return gallery;
    let current = 0;
    const counter = document.createElement("div");
    counter.className = "ogcal-detail-gallery-counter";
    counter.textContent = `1 / ${images.length}`;
    gallery.appendChild(counter);
    const prevBtn = document.createElement("button");
    prevBtn.className = "ogcal-detail-gallery-prev";
    prevBtn.innerHTML = "&#8249;";
    prevBtn.setAttribute("aria-label", "Previous image");
    gallery.appendChild(prevBtn);
    const nextBtn = document.createElement("button");
    nextBtn.className = "ogcal-detail-gallery-next";
    nextBtn.innerHTML = "&#8250;";
    nextBtn.setAttribute("aria-label", "Next image");
    gallery.appendChild(nextBtn);
    function goTo(idx) {
      current = (idx + images.length) % images.length;
      imgEl.src = images[current];
      counter.textContent = `${current + 1} / ${images.length}`;
    }
    prevBtn.addEventListener("click", () => goTo(current - 1));
    nextBtn.addEventListener("click", () => goTo(current + 1));
    gallery.setAttribute("tabindex", "0");
    gallery.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        goTo(current - 1);
        e.preventDefault();
      }
      if (e.key === "ArrowRight") {
        goTo(current + 1);
        e.preventDefault();
      }
    });
    return gallery;
  }
  function renderDetailView(container, event, timezone, onBack, config) {
    config = config || {};
    const locale = config.locale;
    const i18n = config.i18n || {};
    const backLabel = i18n.back || "\u2190 Back";
    const locationTemplate = config.locationLinkTemplate || "https://maps.google.com/?q={location}";
    const images = event.images && event.images.length > 0 ? event.images : event.image ? [event.image] : [];
    const hasImages = images.length > 0;
    const detail = document.createElement("div");
    detail.className = "ogcal-detail";
    const backBtn = document.createElement("button");
    backBtn.className = "ogcal-detail-back";
    backBtn.textContent = backLabel;
    backBtn.addEventListener("click", onBack);
    detail.appendChild(backBtn);
    const body = document.createElement("div");
    body.className = hasImages ? "ogcal-detail-body ogcal-detail-body--has-image" : "ogcal-detail-body";
    if (hasImages) {
      const galleryCol = document.createElement("div");
      galleryCol.className = "ogcal-detail-image";
      galleryCol.appendChild(renderGallery(images, escapeHtml(event.title)));
      body.appendChild(galleryCol);
    }
    const content = document.createElement("div");
    content.className = "ogcal-detail-content";
    const title = document.createElement("h2");
    title.className = "ogcal-detail-title";
    title.textContent = event.title;
    content.appendChild(title);
    const meta = document.createElement("div");
    meta.className = "ogcal-detail-meta";
    const dateStr = event.allDay ? formatDate(event.start, timezone, locale) : formatDatetime(event.start, timezone, locale);
    meta.innerHTML = `<div class="ogcal-detail-date">${dateStr}</div>`;
    if (event.location) {
      const mapsUrl = locationTemplate.replace("{location}", encodeURIComponent(event.location));
      meta.innerHTML += `<div class="ogcal-detail-location"><a href="${mapsUrl}" target="_blank" rel="noopener">${escapeHtml(event.location)}</a></div>`;
    }
    content.appendChild(meta);
    if (event.description) {
      const desc = document.createElement("div");
      desc.className = "ogcal-detail-description";
      desc.innerHTML = renderDescription(event.description, config);
      content.appendChild(desc);
    }
    if (event.links && event.links.length > 0) {
      const linksDiv = document.createElement("div");
      linksDiv.className = "ogcal-detail-links";
      for (const link2 of event.links) {
        const a = document.createElement("a");
        a.className = "ogcal-detail-link";
        a.href = link2.url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = link2.label;
        linksDiv.appendChild(a);
      }
      content.appendChild(linksDiv);
    }
    body.appendChild(content);
    detail.appendChild(body);
    container.innerHTML = "";
    container.appendChild(detail);
    backBtn.focus();
  }

  // src/og-cal.js
  var DEFAULTS = {
    defaultView: "month",
    showPastEvents: false,
    views: ["month", "week", "day", "grid", "list"],
    theme: {},
    locale: null,
    // defaults to navigator.language || 'en-US' at runtime
    weekStartDay: 0,
    // 0=Sunday, 1=Monday, etc.
    storageKeyPrefix: "ogcal",
    mobileBreakpoint: 768,
    mobileDefaultView: "list",
    mobileHiddenViews: ["week"],
    maxEventsPerDay: 3,
    locationLinkTemplate: "https://maps.google.com/?q={location}",
    imageExtensions: null,
    // null = use defaults in images.js
    knownPlatforms: null,
    // null = use defaults in links.js
    sanitization: null,
    // null = use defaults in description.js
    eventFilter: null,
    eventTransform: null,
    onEventClick: null,
    onViewChange: null,
    onError: null,
    onDataLoad: null,
    renderEmpty: null,
    renderLoading: null,
    renderError: null,
    i18n: {}
  };
  var I18N_DEFAULTS = {
    viewLabels: { month: "Month", week: "Week", day: "Day", grid: "Grid", list: "List" },
    noUpcomingEvents: "No upcoming events.",
    showPastEvents: "Show past events",
    hidePastEvents: "Hide past events",
    couldNotLoad: "Could not load events.",
    retry: "Retry",
    allDay: "All Day",
    noEventsThisDay: "No events this day.",
    back: "\u2190 Back",
    moreEvents: "+{count} more"
  };
  var THEME_DEFAULTS = {
    primary: "#8B4513",
    primaryText: "#ffffff",
    background: "#f5f0eb",
    surface: "#ffffff",
    text: "#1a1a1a",
    textSecondary: "#666",
    radius: "8px",
    fontFamily: "system-ui, sans-serif"
  };
  function init(userConfig) {
    const config = { ...DEFAULTS, ...userConfig };
    config.i18n = { ...I18N_DEFAULTS, ...config.i18n };
    if (config.i18n.viewLabels) {
      config.i18n.viewLabels = { ...I18N_DEFAULTS.viewLabels, ...userConfig && userConfig.i18n && userConfig.i18n.viewLabels };
    }
    config.locale = config.locale || typeof navigator !== "undefined" && navigator.language || "en-US";
    const theme = { ...THEME_DEFAULTS, ...config.theme };
    const el = typeof config.el === "string" ? document.querySelector(config.el) : config.el;
    if (!el) {
      console.error("og-cal: Element not found:", config.el);
      return;
    }
    for (const [key, value] of Object.entries(theme)) {
      const prop = `--ogcal-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
      el.style.setProperty(prop, value);
    }
    el.classList.add("ogcal");
    const selectorContainer = document.createElement("div");
    selectorContainer.className = "ogcal-selector-container";
    const viewContainer = document.createElement("div");
    viewContainer.className = "ogcal-view-container";
    viewContainer.setAttribute("aria-live", "polite");
    const toggleContainer = document.createElement("div");
    toggleContainer.className = "ogcal-toggle-container";
    el.innerHTML = "";
    el.appendChild(selectorContainer);
    el.appendChild(viewContainer);
    el.appendChild(toggleContainer);
    let data = null;
    let showPast = config.showPastEvents;
    let currentDate = /* @__PURE__ */ new Date();
    let lastView = null;
    const isMobile = () => window.innerWidth < config.mobileBreakpoint;
    function getFilteredEvents() {
      if (!data) return [];
      if (showPast) return data.events;
      return data.events.filter((e) => !isPast(e.end || e.start));
    }
    function hasPastEvents() {
      if (!data) return false;
      return data.events.some((e) => isPast(e.end || e.start));
    }
    function renderView(viewState) {
      const events = getFilteredEvents();
      const timezone = data?.calendar?.timezone || "UTC";
      if (config.onViewChange && viewState.view !== "detail") {
        const oldView = lastView;
        if (oldView !== viewState.view) {
          config.onViewChange(viewState.view, oldView);
        }
      }
      if (viewState.view !== "detail") {
        renderViewSelector(selectorContainer, config.views, viewState.view, isMobile(), config);
        lastView = viewState.view;
      }
      switch (viewState.view) {
        case "month":
          renderMonthView(viewContainer, events, timezone, currentDate, config);
          break;
        case "week":
          renderWeekView(viewContainer, events, timezone, currentDate, config);
          break;
        case "day": {
          const dayDate = viewState.date ? new Date(viewState.date) : currentDate;
          renderDayView(viewContainer, events, timezone, dayDate, config);
          break;
        }
        case "grid":
          renderGridView(viewContainer, events, timezone, config);
          break;
        case "list":
          renderListView(viewContainer, events, timezone, config);
          break;
        case "detail": {
          const event = data?.events?.find((e) => e.id === viewState.eventId);
          if (event) {
            if (config.onEventClick) {
              const result = config.onEventClick(event, "detail");
              if (result === false) return;
            }
            selectorContainer.innerHTML = "";
            renderDetailView(viewContainer, event, timezone, () => {
              setView(lastView || config.defaultView, config);
            }, config);
          } else {
            renderError(viewContainer, "Event not found.", () => renderView({ view: config.defaultView }), config);
          }
          return;
        }
      }
      if (hasPastEvents()) {
        renderPastToggle(toggleContainer, showPast, () => {
          showPast = !showPast;
          renderView(viewState);
        }, config);
      } else {
        toggleContainer.innerHTML = "";
      }
      if (events.length === 0 && viewState.view !== "detail") {
        renderEmpty(viewContainer, hasPastEvents(), () => {
          showPast = true;
          renderView(viewState);
        }, config);
      }
    }
    async function start() {
      renderLoading(viewContainer, config);
      try {
        data = await loadData(config);
        if (config.onDataLoad) {
          config.onDataLoad(data);
        }
      } catch (err) {
        console.error("og-cal:", err);
        if (config.onError) {
          config.onError(err);
        }
        renderError(viewContainer, err.message, start, config);
        return;
      }
      const initial = getInitialView(config.defaultView, config.views, config);
      if (isMobile() && !parseHash()) {
        initial.view = config.mobileDefaultView;
      }
      renderView(initial);
      onHashChange((viewState) => {
        renderView(viewState);
      });
    }
    start();
  }
  function autoInit() {
    const elements = document.querySelectorAll("[data-og-cal]");
    for (const el of elements) {
      const config = { el };
      const dataset = el.dataset;
      if (dataset.calendarId || dataset.apiKey) {
        config.google = {};
        if (dataset.calendarId) config.google.calendarId = dataset.calendarId;
        if (dataset.apiKey) config.google.apiKey = dataset.apiKey;
        if (dataset.maxResults) config.google.maxResults = parseInt(dataset.maxResults, 10);
      }
      if (dataset.fetchUrl) config.fetchUrl = dataset.fetchUrl;
      if (dataset.defaultView) config.defaultView = dataset.defaultView;
      if (dataset.locale) config.locale = dataset.locale;
      if (dataset.weekStartDay) config.weekStartDay = parseInt(dataset.weekStartDay, 10);
      if (dataset.storageKeyPrefix) config.storageKeyPrefix = dataset.storageKeyPrefix;
      if (dataset.mobileBreakpoint) config.mobileBreakpoint = parseInt(dataset.mobileBreakpoint, 10);
      if (dataset.mobileDefaultView) config.mobileDefaultView = dataset.mobileDefaultView;
      if (dataset.maxEventsPerDay) config.maxEventsPerDay = parseInt(dataset.maxEventsPerDay, 10);
      if (dataset.locationLinkTemplate) config.locationLinkTemplate = dataset.locationLinkTemplate;
      if (dataset.showPastEvents !== void 0) config.showPastEvents = dataset.showPastEvents === "true";
      const theme = {};
      let hasTheme = false;
      for (const [key, value] of Object.entries(dataset)) {
        if (key.startsWith("theme") && key.length > 5) {
          const themeProp = key.charAt(5).toLowerCase() + key.slice(6);
          theme[themeProp] = value;
          hasTheme = true;
        }
      }
      if (hasTheme) config.theme = theme;
      if (dataset.views) {
        config.views = dataset.views.split(",").map((v) => v.trim());
      }
      if (dataset.mobileHiddenViews) {
        config.mobileHiddenViews = dataset.mobileHiddenViews.split(",").map((v) => v.trim());
      }
      init(config);
    }
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", autoInit);
    } else {
      Promise.resolve().then(autoInit);
    }
  }
  return __toCommonJS(og_cal_exports);
})();
//# sourceMappingURL=og-cal.js.map
