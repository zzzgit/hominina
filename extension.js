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
	initialCommit,
	author
let blames,
	commits

const fetchWorkspaceInfo = async(workspacePath)=> {
	rootPath = await utils.getRepoRoot(workspacePath)
	Promise.all([utils.getAuthor(), utils.getInital(rootPath)]).then((values)=> {
		author = values[0]
		initialCommit = values[1]
		// console.log('root:', rootPath, initialCommit)
		return null
	}).catch((e)=> {
		console.error('error:', e)
	})
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
		// console.error('优先级:', 1111111)
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
		const obj = fetchFileInfo(file)
		console.log('obj:', obj)
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
	const blameResult = await utils.getBlameOfFile(document, rootPath)
	blames = blameResult.result
	commits = blameResult.commits
	if(lineNumber + 1 >= blames.length){
		return null
	}
	// 1 based
	const { hash } = blames[lineNumber + 1]
	const isUncommitted = hash == uncommittedHash
	const uncommittedInfo = {
		author: 'You', comment: 'Uncommitted changes', authorTime: '',
	}
	const info = isUncommitted ? uncommittedInfo : commits[hash]
	if(info.author == author.name){
		info.author = 'You'
	}
	const diffInfo = await utils.getDiff(document, rootPath, lineNumber + 1, hash, info.prevHash, initialCommit)
	// console.info('diffInfo:', diffInfo)
	const decorationType = vscode.window.createTextEditorDecorationType({
		after: {
			contentText: `${info.author}, ${info.authorTime}\t•\t${info.comment}`,
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
	const md = new vscode.MarkdownString()
	md.appendMarkdown(`${info.authorTime2822}\t•\t(${info.authorTime})\n\n`)
	md.appendMarkdown(`<span style='color: var(--vscode-charts-green);'>${info.prevHash || ''}\t..\t${hash}</span>\n\n`)
	// md.appendMarkdown(`[copy](${copyHash})\n\n`)
	// md.appendMarkdown('<br />')
	md.appendCodeblock(`${diffInfo}`, 'diff')
	// md.appendMarkdown(`${blames[lineNumber + 1].code}`)
	md.supportHtml = true
	md.supportThemeIcons = true
	md.isTrusted = true
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
// copy hash
// const copyHash = vscode.Uri.parse(`command:editor.action.clipboardCopyAction?${encodeURIComponent(JSON.stringify([uncommittedHash]))}`)
module.exports = {
	activate,
	deactivate,
}
