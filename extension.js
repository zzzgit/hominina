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
let lastVisitedLine = -1
let isMultiRoot = false
let	lastDecor,
	repositoryPath,
	initialCommit,
	author

const fetchWorkspaceInfo = async(workspacePath)=> {
	repositoryPath = await utils.getRepoRoot(workspacePath)
	Promise.all([utils.getAuthor(repositoryPath), utils.getInital(repositoryPath)]).then((values)=> {
		author = values[0]
		initialCommit = values[1]
		return null
	}).catch((e)=> {
		console.error('error:', e)
	})
}
/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context){
	if(workspace.workspaceFolders?.length > 1){
		isMultiRoot = true
	}
	if(isMultiRoot){
		return null
	}
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

	const disposableClear = vscode.commands.registerCommand('hominina.clearCache', ()=> {
		hideDecoration()
		Object.keys(fileInfos).forEach((key)=> {
			delete fileInfos[key]
		})
	})
	context.subscriptions.push(disposableClear)

	const disposableSavedChange = vscode.workspace.onDidSaveTextDocument(async(document)=> {
		if(document.isDirty){
			return null
		}
		const path = document.uri.fsPath
		const isTracked = await fetchTrackedInfo(document)
		if(!isTracked){
			return null
		}
		updateBlameInfo(path, repositoryPath)
	})
	context.subscriptions.push(disposableSavedChange)

	const disposableEditorChange = vscode.window.onDidChangeActiveTextEditor(async(editor)=> {
		if (!editor){
			return null
		}
		const path = editor.document.uri.fsPath
		const isTracked = await fetchTrackedInfo(editor.document)
		if(!isTracked){
			return null
		}
		fetchBlameInfo(path, repositoryPath)
	})
	context.subscriptions.push(disposableEditorChange)

	const disposableSelectionChange = vscode.window.onDidChangeTextEditorSelection(async(_event)=> {
		const editor = vscode.window.activeTextEditor
		if (!editor){
			return null
		}
		if(!await fetchTrackedInfo(editor.document)){
			return null
		}
		const lineNumber = editor.selection.active.line
		if(lastVisitedLine === lineNumber){
			return null
		}
		emitter.fire(lineNumber)
	})
	context.subscriptions.push(disposableSelectionChange)
}

const updateTrackedInfo = async(document)=> {
	const file = document.uri.fsPath
	if(!fileInfos[file]){
		fileInfos[file] = { }
	}
	if(document.isUntitled){
		fileInfos[file].isTracked = false
		return null
	}
	const path = document.uri.fsPath
	if(!repositoryPath || !path.startsWith(repositoryPath)){
		fileInfos[file].isTracked = false
		return null
	}
	const isTracked = await utils.checkTracked(file, repositoryPath)
	fileInfos[file].isTracked = isTracked
}
const fetchTrackedInfo = async(document)=> {
	const file = document.uri.fsPath
	if(!fileInfos[file] || fileInfos[file].isTracked === undefined){
		await updateTrackedInfo(document)
	}
	return fileInfos[file].isTracked
}

const updateBlameInfo = async(file, repoPath)=> {
	if(!fileInfos[file]){
		fileInfos[file] = { }
	}
	if(fileInfos[file].blameInfo === undefined){
		const blameResult = await utils.getBlameOfFile(file, repoPath)
		fileInfos[file].blameInfo = blameResult
	}
}
const fetchBlameInfo = async(file, repoPath)=> {
	if(!fileInfos[file] || fileInfos[file].blameInfo === undefined){
		await updateBlameInfo(file, repoPath)
	}
	return fileInfos[file].blameInfo
}

const showDecoration = async(lineNumber)=> {
	const editor = vscode.window.activeTextEditor
	const document = editor.document.uri.fsPath
	const { commits, result: blames } = await fetchBlameInfo(document, repositoryPath)
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
	if(info.author == author.name && info.authorMail == author.email){
		info.author = 'You'
	}
	const diffInfo = await utils.getDiff(document, repositoryPath, lineNumber + 1, hash, info.prevHash, initialCommit)
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
	md.appendMarkdown(`${info.authorTime2822}\t•\t(*${info.authorTime}*)\n\n`)
	md.appendMarkdown(`<span style='color:#444;'>-${info.prevHash || ''}</span>\n\n`)
	md.appendMarkdown(`<span style='color:#444;'>+${hash}</span>\n\n`)
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
	lastVisitedLine = lineNumber
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
