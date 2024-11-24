const cp = require('node:child_process')
const promisify = require('node:util').promisify
const exec = promisify(cp.exec)

const uncommittedHash = '0000000000000000000000000000000000000000'
const emptyHash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

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

const getCommitsInfo = async(filePath, repository)=> {
	const commits = {}
	const delimiter = '||'
	const cmd = `git -C ${repository} log --pretty=format:"%H${delimiter}%an${delimiter}%ae${delimiter}%ar${delimiter}%aD${delimiter}%cn${delimiter}%ce${delimiter}%cr${delimiter}%cD${delimiter}%s" --follow -- ${filePath}`
	return exec(cmd).then(({ stdout })=> {
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
	const cmd = `git -C ${repository} blame --root --porcelain ${filePath}`
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
	return exec(`git -C ${repository} rev-list --max-parents=0 HEAD --`).then(({ stdout })=> stdout.trim())
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
	const cmd = `git -C ${repository} diff --no-ext-diff --minimal -U0 ${commitA} ${commitB} -- ${filePath}`
	return exec(cmd).then(({ stdout })=> stdout)
}

const checkTracked = async(filePath, repository)=> {
	const cmd = `git -C ${repository} ls-files --error-unmatch ${filePath}`
	return exec(cmd).then(()=> true).catch(()=> false)
}

const getRepoRoot = async(workspacePath)=> {
	const cmd = `git -C ${workspacePath} rev-parse --show-toplevel`
	return exec(cmd).then(({ stdout })=> stdout.trim())
}

const getAuthor = ()=> {
	const cmd = 'git config --get-regex ^user\\.'
	return exec(cmd).then(({ stdout })=> {
		let lines = stdout.split('\n')
		lines = lines.filter(line=> line)
		const name = lines[0].split(' ')[1]
		const email = lines[1].split(' ')[1]
		return { name, email }
	})
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
