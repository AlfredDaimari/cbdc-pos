// file that starts the central CBDC

const express = require('express');
const crypto = require('crypto');
const { v4 } = require('uuid')
const cors = require('cors')
const axios = require('axios');

const db = require('./connectDB')


const app = express();

app.use(express.json())
app.use(cors())
app.use(express.json())

const getUTCString = () => {
    return (new Date()).toUTCString()
}

var PHASE = "ONLINE"

// time to init

let time = new Date()
let utc_min = (new Date()).getUTCMinutes()
utc_min = utc_min + 5 - ((utc_min + 5) % 5)

let yr = time.getUTCFullYear()
let mnt = time.getUTCMonth()
let dt = time.getUTCDate()
let hr = time.getUTCHours()

let tdt = Date.UTC(yr, mnt, dt, hr, utc_min, 1)


// time to init

// query the peer network for txns every 15mins, stay up for 10 min, go temporarily down for 5 mins 

/*

server offline emulation

setTimeout(() => {

    setTimeout(() => {
        console.log(`Now server is going offline -- ${getUTCString()}`)
        PHASE = 'OFFLINE'
    }, 10 * 60 * 1000)


    // for mimicking server down
    setInterval(() => {

        console.log(`Server is coming back online -- ${getUTCString()}`)
        PHASE = 'ONLINE'

        setTimeout(() => {
            console.log(`Now server is going offline -- ${getUTCString()}`)
            PHASE = 'OFFLINE'
        }, 10 * 60 * 1000)


    }, 15 * 60 * 1000)
}, tdt - Date.now())

*/


// get all transactions
app.post('/txns', async (req, res) => {
    try {

        const txns = await db.getTxns(req.body.pubKey)
        res.status(200).send(txns)

    } catch (e) {
        console.log(e)
        res.status(400).send()
    }
})


// create users - will create txn with 10000 amount (for testing purposes)
app.post('/create', async (req, res) => {
    try {
        await db.addTxnsToDB([{
            id: v4(),
            pubKey: req.body.pubKey,
            amount: 1000,
            spent: false,
            origin: "0",
        }, {
            id: v4(),
            pubKey: req.body.pubKey,
            amount: 1000,
            spent: false,
            origin: "0",
        }])

    } catch (e) {
        console.log(e)
    }
})


app.get('/phase', (_, res) => {
    res.status(200).send(PHASE)
})

/**
 * {
 * btxn:{
 * 
 * },
 * rpubKey,
 * signature : btxn,
 * }
 */


// spending a transaction with CBDC
app.post('/txn/spend', async (req, res) => {
    try {
        console.log(req.body)

        let og_txn = req.body["btxn"]

        let tst = JSON.stringify(og_txn)
        tst += req.body.rpubKey
        tst += req.body.amount.toString()

        let data = Buffer.from(tst)

        const isValidUsr = crypto.verify("sha256", data, og_txn["pubKey"], Buffer.from(req.body["signature"], 'base64'))
        const isValidDB = await db.isTxnValidInTxnDB(og_txn)

        console.log(isValidUsr, isValidDB)

        if (isValidUsr && isValidDB) {
            await db.spendTxns(req.body)
            res.status(200).send()

        } else {
            res.status(400).send()
        }

    } catch (e) {
        console.log(e)
        res.status(400).send()
    }
})

// ! (not secure) move a transaction from cbdc to p2p
app.post('/txn/c2p/:id', async (req, res) => {
    try {

        const signedTxn = await db.getSignedTxn(req.params['id'])
        console.log(signedTxn)
        const nid = v4()

        // sending it to all nodes

        const r1 = axios.post(`http://localhost:4000/txn/c2p/${nid}`, signedTxn)
        const r2 = axios.post(`http://localhost:5000/txn/c2p/${nid}`, signedTxn)
        const r3 = axios.post(`http://localhost:6000/txn/c2p/${nid}`, signedTxn)
        const r4 = axios.post(`http://localhost:7000/txn/c2p/${nid}`, signedTxn)

        axios.all([r1, r2, r3, r4])

        res.status(200).send()

    } catch (e) {
        console.log(e)
        res.status(400).send()
    }
})

// add txn back to CBDC ()
/** 
 * {
 * btxn{
 * 
 * 
 * }
 * signature: btxn || tstamp
 * tstamp
 * id : id of peer that signed it
 * }
*/

app.post('/txn/p2cnt', async (req, res) => {
    try {
        console.log(req.body)

        await db.addTxnP2C(req.body)
        res.status(200).send()

    } catch (e) {
        console.log(e)
        res.status(400).send()
    }
})


db.connectToDB().then(() => {
    console.log('cbdc server is connected to database')
    app.listen(3000, () => { console.log('cbdc server is up and running on port 3000') })
})

