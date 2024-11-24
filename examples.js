// vscode.commands.registerCommand('hominina.createFile', function(){
// 	const fileName = 'localization_config.dart'
// 	const wsEdit = new vscode.WorkspaceEdit()
// 	const wsPath = (vscode.workspace.workspaceFolders)[0].uri.fsPath
// 	const filePath = vscode.Uri.file(wsPath + fileName)
// 	vscode.window.showInformationMessage(filePath.toString())
// 	wsEdit.createFile(filePath, { ignoreIfExists: true })
// 	vscode.workspace.applyEdit(wsEdit)
// 	vscode.window.showInformationMessage('created a new file:' + fileName)
// })
// vscode.commands.registerCommand('hominina.writeVersion', function(){
// 	const content = 'version="1.0.0"'
// 	const filePath = path.join(vscode.workspace.rootPath, 'fileName.extension')
// 	fs.writeFileSync(filePath, content, 'utf8')

// 	const openPath = vscode.Uri.file(filePath)
// 	vscode.workspace.openTextDocument(openPath).then(doc => {
// 		return vscode.window.showTextDocument(doc)
// 	})
// })
// vscode.commands.registerCommand('hominina.foo', function(){
// 	const items = [
// 		{
// 			label: 'Test1 Label',
// 			description: 'Test1 Description',
// 			detail: '$(files) Test1 Detail with icon',
// 		},
// 		{
// 			label: 'Test2 Label',
// 			description: 'Test2 Description',
// 			detail: '$(files) Test2 Detail with icon',
// 		},
// 	]
// 	vscode.window.showQuickPick(items)
// })

// vscode.commands.executeCommand('workbench.action.quickOpen', 'Hello World')
// vscode.window
// 	.showInformationMessage('Do you want to do this?', 'Yes', 'No')
// 	.then(answer => {
// 		if (answer === 'Yes'){
// 			// 
// 		}
// 		return null
// 	})

// const editor = vscode.window.activeTextEditor
// if (!editor){
// 	return null
// }
// const document = editor.document
// const selection = editor.selection

// const word = document.getText(selection)
// const reversed = [...word].reverse().join('')
// editor.edit(editBuilder => {
// 	editBuilder.replace(selection, reversed)
// })
