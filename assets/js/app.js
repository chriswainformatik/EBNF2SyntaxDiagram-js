const bnfToGrammar = new rrdiagram.model.BNFToGrammar()
const grammarToRRDiagram = new rrdiagram.model.GrammarToRRDiagram()

document.addEventListener('DOMContentLoaded', () => {
    // generate button action listener
    document.getElementById('btn-generate').addEventListener('click', () => document.getElementById('svg-output').innerHTML = generateDiagramsFromInput())

    // clear all button action listener
    document.getElementById('btn-clear-input').addEventListener('click', clearInput)
})

function generateDiagramsFromInput() {
    var result = ''
    var userInput = document.getElementById('rules-input').value
    var grammar = bnfToGrammar.convert(userInput)
    var rules = grammar.getRules()
    if (rules.length == 0)
        result += 'No valid rules found!'
    for(var i=0; i<rules.length; i++) {
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