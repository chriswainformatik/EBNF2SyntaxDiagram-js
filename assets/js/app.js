const bnfToGrammar = new rrdiagram.model.BNFToGrammar()
const grammarToRRDiagram = new rrdiagram.model.GrammarToRRDiagram()

document.addEventListener('DOMContentLoaded', () => {
    // generate button action listener
    document.getElementById('btn-generate').addEventListener('click', () => document.getElementById('svg-output').innerHTML = generateDiagramsFromInput())

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
        if (file) window.openedFileContent = await file.text();
        document.getElementById("rules-input").value = window.openedFileContent
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

    // auto resize rules input textarea based on content
    const rulesInput = document.getElementById('rules-input');

    function resizeRulesInput() {
        rulesInput.style.height = 'auto';
        rulesInput.style.height = rulesInput.scrollHeight + 'px';
    }

    rulesInput.addEventListener('input', resizeRulesInput);

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

    // insert example grammar rules
    document.getElementById("insert-example").addEventListener("click", function () {
            const rulesInput = document.getElementById("rules-input");
            rulesInput.value = 'zahl = ziffer { ziffer } [ "," ziffer { ziffer } ];\nziffer = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";';
            rulesInput.focus();
        });
})

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
        result += '<br>' + svg
    }
    return result
}

function clearInput() {
    document.getElementById('rules-input').value = ''
}