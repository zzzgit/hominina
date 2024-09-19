const vscode = require('vscode')
const utils = require('./src/utils')
const DecorationRangeBehavior = vscode.DecorationRangeBehavior
const workspace = vscode.workspace
const maxSmallIntegerV8 = 2 ** 30 - 1
const delayMilli = 500
let lastLine = -1
let lastDecor
let lastDelayed = { reject: ()=> {} }

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context){
	const emitter = new vscode.EventEmitter()
	// how to guarantee that it's the same editor?
	const disposableLineChange = emitter.event((lineNumber)=> {
		hideDecoration()
		const delayed = utils.delay(delayMilli)
		lastDelayed.reject()
		lastDelayed = delayed
		delayed.promise.then(()=> showDecoration(lineNumber)).catch((e)=> { console.log(2222, e) })
	})

	context.subscriptions.push(disposableLineChange)

	const disposableSelectionChange = vscode.window.onDidChangeTextEditorSelection(async(_event)=> {
		const editor = vscode.window.activeTextEditor
		if (!editor){
			return null
		}
		const lineNumber = editor.selection.active.line
		if(lastLine === lineNumber){
			return null
		}
		emitter.fire(lineNumber)
	})
	context.subscriptions.push(disposableSelectionChange)
}
const showDecoration = async(lineNumber)=> {
	// 可以在顶级声明吗？
	const editor = vscode.window.activeTextEditor
	const document = editor.document.uri.fsPath
	const blame = await utils.getBlameOfLine(document, workspace.workspaceFolders[0].uri.fsPath, lineNumber + 1)
	const diffInfo = await utils.getDiff(document, workspace.workspaceFolders[0].uri.fsPath, lineNumber + 1)
	const decorationType = vscode.window.createTextEditorDecorationType({
		after: {
			contentText: `${blame.author}, ${blame.date}`,
			margin: '0 0 0 3em',
			textDecoration: 'none',
		},
		dark: {
			after: {
				color: '#707070',

			},
		},
		light: {
			after: {
				color: '#707070',
			},
		},
		rangeBehavior: DecorationRangeBehavior.OpenOpen,
	})
	// seperate the logic of hovoring
	const regex = /@@.*@@\n(.*)/s
	const diffs = diffInfo.match(regex)[1].split('\n')
	const md = new vscode.MarkdownString()
	md.supportHtml = true
	md.supportThemeIcons = true
	diffs.forEach((line)=> {
		if(line.startsWith('+')){
			md.appendMarkdown(` \n${line}`)
			// md.appendMarkdown('<span style="color: red">green</span>')
		}else if(line.startsWith('-')){
			md.appendMarkdown(` \n${line}`)
		}
		md.appendText(` \n${line}`)
	})

	const option = {
		range: new vscode.Range(lineNumber, maxSmallIntegerV8, lineNumber, maxSmallIntegerV8),
		hoverMessage: md,
	}
	editor.setDecorations(decorationType, [option])
	lastLine = lineNumber
	lastDecor = decorationType
}
const hideDecoration = ()=> {
	const editor = vscode.window.activeTextEditor
	if(lastDecor){
		editor.setDecorations(lastDecor, [])
	}
}
function deactivate(){}

module.exports = {
	activate,
	deactivate,
}
