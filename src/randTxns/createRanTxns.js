// file to create random txns on the blockchain and fill up data in the block, emulation for a busy network

const axios = require('axios')
const fs = require('fs')
const crypto = require('crypto')


const sendTxn = async () => {
    const users = ['1', '2', '3', '4', '5']

    const p = Math.floor(Math.random() * users.length)
    const sen = users[p]

    const r = Math.floor(Math.random() * (users.length - 1))
    const rev = (users.filter(i => i != sen))[r]

    const senPubKey = fs.readFileSync(`${__dirname}/wallet/publicKeyus${sen}.pem`).toString()
    const senPrivKey = fs.readFileSync(`${__dirname}/wallet/privateKeyus${sen}.pem`).toString()
    const revPubKey = fs.readFileSync(`${__dirname}/wallet/publicKeyus${rev}.pem`).toString()

    const txns = await axios.post("http://localhost:5000/txns/get", {
        pubKey: senPubKey
    })

    console.log("=== available txns ===")
    console.log(txns.data)
    console.log("=== available txns ===")

    const theTXN = txns.data[Math.floor(Math.random() * txns.data.length)]

    let tst = JSON.stringify(theTXN)
    tst += revPubKey
    tst += "1"

    tst = Buffer.from(tst)

    const signature = crypto.sign('sha256', tst, senPrivKey).toString('base64')


    const txn = {
        btxn: theTXN,
        signature,
        rpubKey: revPubKey,
        amount: 1,
    }

    await axios.post('http://localhost:4000/txn', txn)
    return txn

}


let time = new Date()

let utc_min = time.getUTCMinutes()
utc_min = utc_min + 5 - ((utc_min + 5) % 5)

let yr = time.getUTCFullYear()
let mnt = time.getUTCMonth()
let dt = time.getUTCDate()
let hr = time.getUTCHours()

let tdt = Date.UTC(yr, mnt, dt, hr, utc_min, 1)
let time_to_init = tdt - Date.now()

setTimeout(() => {

    sendTxn().then((txn) => {
        console.log(`success sending txn --${JSON.stringify(txn)} at -- ${(new Date()).toUTCString()}`)
    })


    setInterval(() => {
        sendTxn().then((txn) => {
            console.log(`success sending txn --${JSON.stringify(txn)} at -- ${(new Date()).toUTCString()}`)
        })
    }, 5 * 60 * 1000)

}, time_to_init)

