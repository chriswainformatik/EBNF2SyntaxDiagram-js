const bnfToGrammar = new rrdiagram.model.BNFToGrammar()
const grammarToRRDiagram = new rrdiagram.model.GrammarToRRDiagram()

document.addEventListener('DOMContentLoaded', () => {
    // generate button action listener
    document.getElementById('btn-generate').addEventListener('click', () => {
        document.getElementById('svg-output').innerHTML = generateDiagramsFromInput()
        const out = document.getElementById('svg-output');
        removeStrayCommas(out);
    })

    // clear all button action listener
    document.getElementById('btn-clear-input').addEventListener('click', clearInput)

    // open file
    window.openedFileContent = null;

    const openFileItem = document.getElementById('open-file');
    const fileInput = document.getElementById('file-input');

    openFileItem.addEventListener('click', () => fileInput.click());
    openFileItem.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            fileInput.click();
        }
    });
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        window.openedFileContent = await file.text();
        document.getElementById("rules-input").value = window.openedFileContent;
        // reset so selecting the same file again still fires a change event
        fileInput.value = '';
    });

    // save file
    document.getElementById("save-file").addEventListener("click", () => {
        const contents = document.getElementById("rules-input").value;
        const file = new Blob([contents], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = "rules.txt";
        link.click();
        URL.revokeObjectURL(url);
    });

    // export diagram as png
    document.getElementById('export-diagrams').addEventListener('click', async () => {
        const rules = [...document.querySelectorAll('#svg-output .rule')];
        if (!rules.length) return;

        const showNames = document.getElementById('rule-names-checkbox').checked;
        const items = rules.map(rule => ({
            svg: rule.querySelector('svg'),
            name: showNames ? rule.dataset.ruleName : null
        }));
        const svg = combineSvgs(items);
        if (!document.getElementById('colored-checkbox').checked)
            applyGrayscaleFilter(svg);
        try {
            const blob = await svgToPngBlob(svg, { scale: 2 });
            downloadBlob(blob, 'diagram.png');
        } catch (err) {
            console.error(err);
            alert('Could not export the diagram.');
        }
    });

    // auto resize rules input textarea based on content
    const rulesInput = document.getElementById('rules-input');

    function resizeRulesInput() {
        rulesInput.style.height = 'auto';
        // scrollHeight excludes the borders, but Bootstrap uses box-sizing: border-box,
        // so the borders have to be added back to avoid shrinking the textarea
        const borders = rulesInput.offsetHeight - rulesInput.clientHeight;
        rulesInput.style.height = (rulesInput.scrollHeight + borders) + 'px';
    }

    bindControl(rulesInput, 'input', resizeRulesInput);

    // File loading assigns the textarea's value without firing an input event
    const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    Object.defineProperty(rulesInput, 'value', {
        configurable: true,
        get() {
            return valueDescriptor.get.call(this);
        },
        set(value) {
            valueDescriptor.set.call(this, value);
            resizeRulesInput();
        }
    });

    const coloredCheckbox = document.getElementById("colored-checkbox");
    const svgOutput = document.getElementById("svg-output");
    bindControl(coloredCheckbox, "change", () => {
        svgOutput.classList.toggle("monochrome", !coloredCheckbox.checked);
    });

    const ruleNamesCheckbox = document.getElementById("rule-names-checkbox");
    bindControl(ruleNamesCheckbox, "change", () => {
        svgOutput.classList.toggle("hide-rule-names", !ruleNamesCheckbox.checked);
    });

    // insert example grammar rules
    document.getElementById("insert-example").addEventListener("click", function () {
        const rulesInput = document.getElementById("rules-input");
        rulesInput.value = 'zahl = ziffer { ziffer } [ "," ziffer { ziffer } ];\nziffer = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";';
        rulesInput.focus();
    });

})

// Bind UI that is derived from a form control's state.
// Browsers restore form state on reload and back/forward navigation without firing
// input/change events, so `update` also runs immediately and on every pageshow
// (which fires after restoration, including bfcache restores). `update` must be idempotent.
function bindControl(el, eventName, update) {
    el.addEventListener(eventName, update);
    window.addEventListener('pageshow', update);
    update();
}

function generateDiagramsFromInput() {
    var result = ''
    var userInput = document.getElementById('rules-input').value
    var grammar = bnfToGrammar.convert(userInput)
    var rules = grammar.getRules()
    if (rules.length == 0)
        result += 'No valid rules found!'
    for (var i = 0; i < rules.length; i++) {
        var rrDiagram = grammarToRRDiagram.convert(rules[i])
        var rrDiagramToSVG = new rrdiagram.ui.RRDiagramToSVG()
        var svg = rrDiagramToSVG.convert(rrDiagram)
        var name = escapeHtml(rules[i].getName())
        result += `<div class="rule" data-rule-name="${name}"><div class="rule-name">${name}</div>${svg}</div>`
    }
    return result
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function clearInput() {
    document.getElementById('rules-input').value = ''
}

function removeStrayCommas(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const toRemove = [];
    while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentNode.localName;
        if (node.nodeValue === ',' && parent !== 'text' && parent !== 'tspan') {
            toRemove.push(node);
        }
    }
    toRemove.forEach(n => n.remove());
}

/* ##### Generating an output png ##### */

// Clone an SVG and bake the CSS-derived styles into it
function cloneWithInlineStyles(svg) {
    const clone = svg.cloneNode(true);
    const props = [
        'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
        'stroke-dasharray', 'opacity', 'font-family', 'font-size',
        'font-weight', 'font-style', 'text-anchor', 'dominant-baseline'
    ];
    const srcNodes = svg.querySelectorAll('*');
    const dstNodes = clone.querySelectorAll('*');

    srcNodes.forEach((src, i) => {
        const computed = getComputedStyle(src);
        const style = props.map(p => `${p}:${computed.getPropertyValue(p)}`).join(';');
        dstNodes[i].setAttribute('style', style);
    });
    return clone;
}

// Stack several SVGs vertically into one, each optionally preceded by a name label.
// items: [{ svg: SVGElement, name: string | null }]
function combineSvgs(items, gap = 20) {
    const NS = 'http://www.w3.org/2000/svg';
    const labelHeight = 24;
    const labelFont = 'bold 14px Arial, sans-serif';

    // measure label widths so they are never clipped
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = labelFont;
    const blockHeight = ({ svg, name }) => +svg.getAttribute('height') + (name ? labelHeight : 0);
    const blockWidth = ({ svg, name }) =>
        Math.max(+svg.getAttribute('width'), name ? Math.ceil(ctx.measureText(name).width) + 2 : 0);

    const width = Math.max(...items.map(blockWidth));
    const height = items.reduce((h, item) => h + blockHeight(item) + gap, -gap);

    const outer = document.createElementNS(NS, 'svg');
    outer.setAttribute('xmlns', NS);
    outer.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    outer.setAttribute('width', width);
    outer.setAttribute('height', height);
    outer.setAttribute('viewBox', `0 0 ${width} ${height}`);

    let y = 0;
    items.forEach(item => {
        if (item.name) {
            const label = document.createElementNS(NS, 'text');
            label.setAttribute('x', 0);
            label.setAttribute('y', y + 16);
            label.setAttribute('style', 'font:' + labelFont + ';fill:#000000');
            label.textContent = item.name;
            outer.appendChild(label);
        }
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('transform', `translate(0,${y + (item.name ? labelHeight : 0)})`);
        const styled = cloneWithInlineStyles(item.svg);
        while (styled.firstChild) g.appendChild(styled.firstChild);
        outer.appendChild(g);
        y += blockHeight(item) + gap;
    });
    return outer;
}

// Convert an SVG element to a PNG Blob
function svgToPngBlob(svgEl, { scale = 2, background = '#ffffff' } = {}) {
    return new Promise((resolve, reject) => {
        const width = +svgEl.getAttribute('width');
        const height = +svgEl.getAttribute('height');

        const xml = new XMLSerializer().serializeToString(svgEl);
        const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * scale;     // scale > 1 = sharper PNG
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d');

            if (background) {
                ctx.fillStyle = background;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);

            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png');
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG failed to load')); };
        img.src = url;
    });
}

// Trigger the download
function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function applyGrayscaleFilter(svgEl) {
    const NS = 'http://www.w3.org/2000/svg';

    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = `
    <filter id="mono" color-interpolation-filters="sRGB">
      <feColorMatrix type="saturate" values="0"/>
    </filter>`;

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('filter', 'url(#mono)');
    while (svgEl.firstChild) g.appendChild(svgEl.firstChild);

    svgEl.append(defs, g);
    return svgEl;
}