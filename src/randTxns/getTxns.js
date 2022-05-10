const axios = require('axios')
const fs = require('fs')


const pubKey = fs.readFileSync(`${__dirname}/wallet/publicKeyus1.pem`).toString()
axios.post('http://localhost:4000/txns/get', {
    pubKey
}).then((v) => console.log(v))