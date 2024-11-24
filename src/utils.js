const cp = require('node:child_process')
const promisify = require('node:util').promisify
const exec = promisify(cp.exec)

const uncommittedHash = '0000000000000000000000000000000000000000'
const emptyHash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

const getBlameOfLine = async(filePath, repository, lineNumber)=> {
	return executeGit('blame', repository, `--date relative -L ${lineNumber},+1`, filePath)
}

const getCommitsInfo = async(filePath, repository)=> {
	const commits = {}
	const delimiter = '||'
	const cmd = executeGit('log', repository, `--pretty=format:"%H${delimiter}%an${delimiter}%ae${delimiter}%ar${delimiter}%aD${delimiter}%cn${delimiter}%ce${delimiter}%cr${delimiter}%cD${delimiter}%s" --follow`, filePath)
	return cmd.then(({ stdout })=> {
		const lines = stdout.split('\n')
		lines.forEach((line)=> {
			const parts = line.split(delimiter)
			const hash = parts[0]
			commits[hash] = {
				author: parts[1],
				authorMail: parts[2],
				authorTime: parts[3],
				authorTime2822: parts[4],
				committer: parts[5],
				committerMail: parts[6],
				committerTime: parts[7],
				committerTime2822: parts[8],
				comment: parts[9],
			}
		})
		return commits
	})
}

const getBlameOfFile = async(filePath, repository)=> {
	const commits = await getCommitsInfo(filePath, repository)
	const cmd = executeGit('blame', repository, '--root --porcelain', filePath)
	return cmd.then(({ stdout })=> {
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
		const result = []
		sections.forEach((section)=> {
			_parseSection(section, result, commits)
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
const _parseSection = (section, result, commits)=> {
	const hashLine = section[0]
	const { hash, lineNum } = _parseHashLine(hashLine)
	// const isWithCommitMessage = section.length > 5
	const code = section[section.length - 1].slice(1)
	const prevHashLine = section.find(line=> line.startsWith('previous'))
	if(prevHashLine){
		if(commits[hash]){
			commits[hash].prevHash = prevHashLine.split(' ')[1]
		}
	}
	const item = {
		hash,
		code,
		// lineNum,
	}
	result[lineNum] = item
}
const getInital = (repository)=> {
	return executeGit('rev-list', repository, '--max-parents=0 HEAD').then(({ stdout })=> stdout.trim())
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
const getDiff = async(filePath, repository, lineNumber, hash, prevHash, initialCommit)=> {
	if(hash == uncommittedHash){
		return ''
	}
	let commitA
	const commitB = hash
	const isInitial = hash === initialCommit
	if(isInitial){
		commitA = emptyHash
	}else{
		commitA = prevHash || hash + '^'
	}
	// const cmd = `git -C ${repository} log --oneline -L ${lineNumber},+1:'${filePath}' -n 1`
	const cmd = executeGit('diff', repository, `--no-ext-diff --minimal -U0 ${commitA} ${commitB}`, filePath)
	return cmd.then(({ stdout })=> stdout)
}

const checkTracked = async(filePath, repository)=> {
	const cmd = executeGit('ls-files', repository, '--error-unmatch', filePath)
	return cmd.then(()=> true).catch(()=> false)
}

const getRepoRoot = async(workspacePath)=> {
	const cmd = executeGit('rev-parse', workspacePath, '--show-toplevel')
	return cmd.then(({ stdout })=> stdout.trim())
}

const getAuthor = (repository)=> {
	const cmd = executeGit('config', repository, '--get-regex ^user\\.')
	return cmd.then(({ stdout })=> {
		let lines = stdout.split('\n')
		lines = lines.filter(line=> line)
		const email = lines[0].split(' ')[1]
		const name = lines[1].split(' ')[1]
		return { name, email }
	})
}

const executeGit = async(cmd, repository, options, parameters)=> {
	let str = 'git'
	if(repository){
		str += ` -C ${repository}`
	}
	str += ` ${cmd}`
	if(options){
		str += ` ${options}`
	}
	if(parameters){
		str += ` -- ${parameters}`
	}
	console.log('[cmd]:', str)
	return exec(str)
}

module.exports = {
	getDiff,
	getBlameOfLine,
	getBlameOfFile,
	checkTracked,
	delay,
	counter,
	getAuthor,
	getInital,
	getRepoRoot,
}
