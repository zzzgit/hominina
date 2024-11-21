const cp = require('node:child_process')
const promisify = require('node:util').promisify
const exec = promisify(cp.exec)

const _parseBlame = (str)=> {
	const reg = /^(\^?\w{7,8}) \(([^)]+)\) (.*)/
	const res = reg.exec(str)
	if (!res){
		console.log('res:', res)
		return null
	}
	const hash = res[1]
	const info = res[2]
	const code = res[3]
	let author,
		date,
		lineNumber
	if(hash === '00000000'){
		const reg2 = /Not Committed Yet (.+)\s+(\d+)/
		const res2 = reg2.exec(info)
		if (!res2){
			return null
		}
		author = 'Not Committed Yet'
		date = res2[1]
		lineNumber = res2[2]
	}else{
		const reg2 = /(\w+) ([\da-zA-Z ]+) (\d+)/
		const res2 = reg2.exec(info)
		if (!res2){
			return null
		}
		author = res2[1]
		date = res2[2]
		lineNumber = res2[3]
	}
	return {
		hash,
		code,
		author,
		date,
		lineNumber,
	}
}

const getBlameOfLine = async(filePath, repository, lineNumber)=> {
	const cmd = `git -C ${repository} blame --date relative -L ${lineNumber},+1 ${filePath}`
	return exec(cmd).then(({ stdout })=> _parseBlame(stdout))
}

const getBlameOfFile = async(filePath, repository)=> {
	const cmd = `git -C ${repository} blame --porcelain ${filePath}`
	return exec(cmd).then(({ stdout })=> {
		const lines = stdout.split('\n')
		lines.pop()
		const sections = []
		let section = []
		lines.forEach((line)=> {
			if (_startsWithGitHash(line)){
				section = []
				section.push(line)
				sections.push(section)
			} else {
				section.push(line)
			}
		})
		const commits = {}
		const result = []
		sections.forEach((section)=> {
			_parseSection(section, { commits, result })
		})
		return { commits, result }
	})
}
const _parseHashLine = (hashLine)=> {
	const parts = hashLine.split(' ')
	const hash = parts[0]
	const lineNum = parts[2]
	return { hash, lineNum }
}
const _parseSection = (section, { commits, result })=> {
	const hashLine = section[0]
	const { hash, lineNum } = _parseHashLine(hashLine)
	// 实际上大于2就行了，但是末行可能不准确，编辑器加了一行
	const isWithCommitMessage = section.length > 5
	if (isWithCommitMessage){
		const obj = {}
		for (let i = 1; i < section.length; i++){
			const line = section[i]
			const segment = line.split(' ')
			switch (segment[0]){
			case 'author':
				obj.author = segment[1]
				break
			case 'author-mail':
				obj.authorMail = segment[1]
				break
			case 'author-time':
				obj.authorTime = +segment[1]
				break
			case 'author-tz':
				obj.authorTz = segment[1]
				break
			case 'committer':
				obj.committer = segment[1]
				break
			case 'committer-mail':
				obj.committerMail = segment[1]
				break
			case 'committer-time':
				obj.committerTime = +segment[1]
				break
			case 'committer-tz':
				obj.committerTz = segment[1]
				break
			case 'summary':
				obj.comment = line.substring(8)
				break

			default:
				break
			}
		}
		commits[hash] = obj
		const item = {
			hash,
			// lineNum,
			code: section[section.length - 1].slice(1),
		}
		result[lineNum] = item
	}else{
		const item = {
			hash,
			code: section[1].slice(1),
			// lineNum,
		}
		result[lineNum] = item
	}
	_parseCommit(hash, section, commits)
}
const _parseCommit = (hash, section, commits)=> {
	if (!commits[hash]){
		commits[hash] = {}
	}
	if (Object.keys(commits[hash]).length === 0){
		if (section.length > 2){
			commits[hash].message = section[2]
		}
	}
}
const _startsWithGitHash = (line)=> {
	const gitHashRegex = /^[a-f0-9]{40}/
	return gitHashRegex.test(line)
}
let id = 0
const counter = ()=> {
	id++
	return id
}
const delay = (ms)=> {
	let _reject
	const promise = new Promise((resolve, reject)=> {
		setTimeout(()=> {
			resolve()
		}, ms)
		_reject = reject
	})
	return { promise, reject: _reject }
}
const getDiff = async(filePath, repository, lineNumber)=> {
	const cmd = `git -C ${repository} log --oneline -L ${lineNumber},+1:'${filePath}' -n 1`
	return exec(cmd).then(({ stdout })=> stdout)
}

module.exports = {
	getDiff,
	getBlameOfLine,
	getBlameOfFile,
	delay,
	counter,
}
