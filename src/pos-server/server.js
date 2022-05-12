const express = require('express');
const app = express()
const cors = require('cors')
const fs = require('fs')
const axios = require('axios')

const { Vote, Pool, Validate, Commit, utility } = require('./peer')
const { connectToDB, getBlocksFromH, getTxns, getLast10Blocks, saveCTxnToP2P, txnP2P_TO_C } = require('./connectDB');


app.use(cors())
app.use(express.json())

const PUB_KEY = fs.readFileSync(`${__dirname}/${process.argv[2]}/wallet/publicKey.pem`).toString()
const PRV_KEY = fs.readFileSync(`${__dirname}/${process.argv[2]}/wallet/privateKey.pem`).toString()
const PORT = process.argv[2]

let vote_ = new Vote(PUB_KEY, PRV_KEY)
let pool_ = new Pool(PUB_KEY, PRV_KEY)
let validate_ = new Validate(PUB_KEY, PRV_KEY)
let commit_ = new Commit(PUB_KEY, PRV_KEY)


/**
 * Things that have not been implemented
 * !
 * !
 * !
 */

// to move token or coin from central CBDC to p2p

app.post('/txn/c2p/:nid', async (req, res) => {
    try {
        await saveCTxnToP2P(req.body, req.params["nid"])
        res.status(200).send()

    } catch (e) {
        console.log(e)
        res.status(400).send()
    }
})

// !(not secure (not dependent on signature)) to move token form p2p to CBDC

app.post('/txn/p2c/:id/:send', async (req, res) => {
    try {
        const txn = await txnP2P_TO_C(req.params["id"])

        console.log(`moving txns ${JSON.stringify(txn)}-- -- ${utility.getUTCString()} to CBDC`)

        // send back to cbdc to convert p2p money to cbdc
        if (req.params["send"] == "yes") {
            await axios.post('http://localhost:3000/txn/p2cnt', txn)
        }

        res.status(200).send()

    } catch (e) {
        console.log(e)
        res.status(400).send()
    }
})


app.post('/txns/get', async (req, res) => {
    try {
        const txns = await getTxns(req.body.pubKey)
        res.status(200).send(txns)

    } catch (e) {
        console.log(e)
        res.status(200).send()
    }
})

app.post('/vote/stake', async (req, res) => {
    try {
        vote_.addStake(req.body)
        res.status(200).send()
    } catch (e) {
        console.log(e)
        res.status(200).send()
    }
})


app.post('/vote/vote', async (req, res) => {
    try {
        vote_.addVote(req.body)
        res.status(200).send()

    } catch (e) {
        console.log(e)
        res.status(200).send()
    }
})

app.post('/txn', (req, res) => {
    try {
        pool_.addtoTxnsPool(req.body)
        res.status(200).send()
    } catch (e) {
        console.log(e)
        res.status(200).send()
    }
})

// get last 10 blocks -- for frontend
app.get('/blocklst', async (_, res) => {
    try {

        const block = await getLast10Blocks()
        res.status(200).send(block)

    } catch (e) {

        console.log(e)
        res.status(400).send()
    }
})


// will be used to get block information
app.get('/block/:lstbk', async (req, res) => {
    try {
        const blocks = await getBlocksFromH(req.params["lstbk"])
        res.status(200).send(blocks)
    } catch (e) {
        console.log(e)
        res.status(400).send()
    }
})


app.post('/block', async (req, res) => {
    try {
        validate_.updateBlock(req.body)
        res.status(200).send()
    } catch (e) {
        console.log(e)
        res.status(200).send()
    }
})

app.post('/block/vote', async (req, res) => {
    try {
        validate_.addToBlockSnts(req.body)  // add to block signatories
        res.status(200).send()
    } catch (e) {
        console.log(e)
        res.status(200).send()
    }
})

app.post('/commit/block', async (req, res) => {
    try {
        commit_.updateBlock(req.body)  // update block with signatories on peers
        res.status(200).send()
    } catch (e) {
        console.log(e)
        res.status(200).send()
    }
})


time = new Date();


connectToDB().then(() => {
    console.log(`connected to db -- ${utility.getUTCString()}`)
    console.log('now setting up server')

    app.listen(PORT, () => {
        console.log(`server is up and running on ${PORT} -- ${utility.getUTCString()}`)
        vote_.init(time)
        pool_.init(time)
        validate_.init(time)
        commit_.init(time)
    })
})


