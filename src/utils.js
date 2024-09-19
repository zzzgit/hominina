const cp = require('node:child_process')
const promisify = require('node:util').promisify
const exec = promisify(cp.exec)

const parseBlame = (str)=> {
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
	return exec(cmd).then(({ stdout })=> parseBlame(stdout))
}

const getBlameOfFile = async(filePath, repository)=> {
	const cmd = `git -C ${repository} blame --date relative ${filePath}`
	return exec(cmd).then(({ stdout })=> {
		const lines = stdout.split('\n')
		return lines.map(parseBlame)
	})
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
	parseBlame,
	getDiff,
	getBlameOfLine,
	getBlameOfFile,
	delay,
	counter,
}
