const vscode = require('vscode')
const utils = require('./src/utils')
// import * as vscode from 'vscode'
// import * as utils from './src/utils'

const DecorationRangeBehavior = vscode.DecorationRangeBehavior
const workspace = vscode.workspace
const fileInfos = {}
const maxSmallIntegerV8 = 2 ** 30 - 1
const delayMilli = 500
const uncommittedHash = '0000000000000000000000000000000000000000'
let lastDelayed = { reject: ()=> {} }
let lastLine = -1
let file = ''
let	lastDecor,
	rootPath,
	author
let blames,
	commits

const fetchWorkspaceInfo = async(workspacePath)=> {
	// 两个合并成一个
	author = await utils.getAuthor()
	rootPath = await utils.getRepoRoot(workspacePath)
}
/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context){
	// 多个工作区怎么办？
	const workspacePath = workspace.workspaceFolders[0].uri.fsPath
	await fetchWorkspaceInfo(workspacePath)

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

	const disposableEditorChange = vscode.window.onDidChangeActiveTextEditor((editor)=> {
		if (!editor){
			return null
		}
		file = editor.document.uri.fsPath
		const scheme = editor.document.uri.scheme
		console.log('scheme:', scheme, editor.document.uri.fsPath)
		fetchFileInfo(file)
	})
	context.subscriptions.push(disposableEditorChange)

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

const fetchFileInfo = async(file)=> {
	if(!fileInfos[file]){
		const isTracked = await utils.checkTracked(file, rootPath)
		fileInfos[file] = { isTracked }
	}
	return fileInfos[file]
}

const showDecoration = async(lineNumber)=> {
	// 可以在顶级声明吗？
	const editor = vscode.window.activeTextEditor
	const document = editor.document.uri.fsPath
	const blame = await utils.getBlameOfFile(document, rootPath)
	blames = blame.result
	commits = blame.commits
	if(lineNumber + 1 >= blames.length){
		return null
	}
	// 1 based
	const hash = blames[lineNumber + 1].hash
	const isUncommitted = hash == uncommittedHash
	const uncommittedInfo = {
		author: 'You', comment: 'Uncommitted changes', authorTime: '',
	}
	const info = isUncommitted ? uncommittedInfo : commits[hash]
	if(info.author == author.name){
		info.author = 'You'
	}
	const diffInfo = await utils.getDiff(document, rootPath, lineNumber + 1)
	const decorationType = vscode.window.createTextEditorDecorationType({
		after: {
			contentText: `${info.author}, ${info.authorTime}	•	${info.comment} / ${blames[lineNumber + 1].code}`,
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
			md.appendMarkdown(` \n⊕${line}`)
			// md.appendMarkdown('<span style="color: red">green</span>')
		}else if(line.startsWith('-')){
			md.appendMarkdown(` \n⊖${line}`)
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
