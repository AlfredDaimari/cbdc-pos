// file for adding a txn to database

const axios = require('axios')
const fs = require('fs')
const crypto = require('crypto')

btxn = {
    id: "0",
    pubKey: fs.readFileSync(`${__dirname}/wallet/publicKeyus1.pem`).toString(),
    amount: 10,
    spent: false,
    origin: "5",
}

rpubKey = fs.readFileSync(`${__dirname}/wallet/publicKeyus2.pem`).toString()
amount = btxn.amount - 2

let txns = [{
    btxn,
    amount,
    rpubKey,
    signature: "",
    signature2: crypto.sign('sha256', Buffer.from(JSON.stringify(btxn) + rpubKey + amount.toString()), fs.readFileSync(`${__dirname}/wallet/privateKeyus1.pem`)).toString('base64'),
}]


axios.post('http://localhost:4000/txn', txns[0])

