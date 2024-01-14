const raw = '部門'

const parse = (raw) => {
	const res = []
	const m = raw.match(/^(.+?)\((.+?)\)$/)
	if (m){
		res.push(m[1])
		res.push(m[2])
	} else {
		res.push(raw)
	}
	return res
}